import { Injectable, Logger } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import { nanoid } from "nanoid";
import type { User } from "@solidchat/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { SecurityEventService } from "../../common/security/security-event.service";
import { AuthService, type AuthTokens, type RequestMeta } from "../auth.service";
import { ClaraSsoConfigService, type ClaraSsoConfig } from "./clara-sso.config";
import { ClaraSsoStateService } from "./clara-sso-state.service";
import { generatePkceAttempt } from "./pkce.util";
import { ClaraIdTokenError, validateClaraIdToken, type ClaraIdTokenClaims } from "./clara-id-token.util";

interface ClaraTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token: string;
}

/**
 * Safe-to-log reason code for a failed login — never the exception message from deeper down,
 * which could echo back a code/token fragment. Bagian B, "Kalau callback gagal ... Log tidak
 * boleh berisi authorization code, code_verifier, client secret, access token, ID token, atau
 * isi session cookie."
 */
export class ClaraSsoLoginError extends Error {}

@Injectable()
export class ClaraSsoService {
  private readonly logger = new Logger(ClaraSsoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ssoConfig: ClaraSsoConfigService,
    private readonly state: ClaraSsoStateService,
    private readonly authService: AuthService,
    private readonly auditLog: AuditLogService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  /** GET /api/v1/auth/clara/login — builds the URL to send the agent's browser to. */
  async buildAuthorizationRedirect(returnPath: string): Promise<string> {
    const cfg = this.ssoConfig.resolve();
    const { state, nonce, codeVerifier, codeChallenge } = generatePkceAttempt();

    await this.state.save(state, { nonce, codeVerifier, returnPath, createdAt: new Date().toISOString() }, cfg.stateTtlSeconds);

    const url = new URL(`${cfg.issuer}/oauth/authorize`);
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", cfg.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  /** GET /api/v1/auth/clara/callback — the whole "Urutan proses callback" from Bagian B. */
  async handleCallback(code: string | undefined, state: string | undefined, meta: RequestMeta): Promise<{ tokens: AuthTokens; returnPath: string }> {
    const cfg = this.ssoConfig.resolve();

    if (!code || !state) {
      throw new ClaraSsoLoginError("missing_code_or_state");
    }

    // 1-4: state must exist, be unexpired, and is consumed (deleted) right here so it can never
    // be replayed even if the rest of this request fails.
    const attempt = await this.state.consume(state);
    if (!attempt) {
      await this.securityEvents.record({
        type: "SSO_LOGIN_FAILED",
        severity: "MEDIUM",
        ipAddress: meta.ipAddress,
        details: { reason: "state_not_found_or_already_used" },
      });
      throw new ClaraSsoLoginError("state_invalid_or_expired");
    }

    // 5: exchange code -> token, server-to-server, with the PKCE verifier from step 1.
    let tokenResponse: ClaraTokenResponse;
    try {
      tokenResponse = await this.exchangeCode(cfg, code, attempt.codeVerifier);
    } catch (error) {
      this.logger.warn(`Clara token exchange failed: ${(error as Error).message}`);
      throw new ClaraSsoLoginError("token_exchange_failed");
    }

    // 6-7: validate the ID token's signature, issuer/audience/nonce, and business claims.
    let claims: ClaraIdTokenClaims;
    try {
      claims = validateClaraIdToken({
        idToken: tokenResponse.id_token,
        clientSecret: cfg.clientSecret,
        issuer: cfg.issuer,
        audience: cfg.clientId,
        expectedNonce: attempt.nonce,
        allowedRoles: cfg.allowedRoles,
        allowedOrganizationId: cfg.allowedOrganizationId,
      });
    } catch (error) {
      const reason = error instanceof ClaraIdTokenError ? error.message : "id_token_invalid";
      await this.securityEvents.record({
        type: "SSO_LOGIN_FAILED",
        severity: "HIGH",
        ipAddress: meta.ipAddress,
        details: { reason },
      });
      throw new ClaraSsoLoginError(reason);
    }

    // 8-9: map to a local user (creating the account on first login — see resolveOrProvisionLocalUser)
    // and build a normal Dashboard session for them.
    const user = await this.resolveOrProvisionLocalUser(cfg, claims, meta);
    const tokens = await this.authService.issueSsoTokens(user.id, meta);

    return { tokens, returnPath: attempt.returnPath || cfg.postLoginPath };
  }

  private async exchangeCode(cfg: ClaraSsoConfig, code: string, codeVerifier: string): Promise<ClaraTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      code_verifier: codeVerifier,
    });
    const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");

    const response = await fetch(`${cfg.issuer}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`clara_token_endpoint_http_${response.status}`);
    }

    return (await response.json()) as ClaraTokenResponse;
  }

  /**
   * Maps a validated Clara identity to a local Dashboard user — creating one automatically on
   * first login, since agent accounts are meant to come FROM Clara. Live Chat should never need
   * a manual "create user first" step for someone who already has a Clara account.
   *
   * `claraUserId` (the token's `sub`) is the permanent identity link once it exists. Email is
   * only ever consulted to (a) avoid creating a duplicate when an account with that email
   * already exists locally, and (b) name the new account on first creation — never again after
   * that (Bagian B, "Jangan menggunakan email atau nama sebagai sumber kebenaran ownership").
   */
  private async resolveOrProvisionLocalUser(cfg: ClaraSsoConfig, claims: ClaraIdTokenClaims, meta: RequestMeta): Promise<User> {
    const byClaraId = await this.prisma.user.findUnique({ where: { claraUserId: claims.sub } });
    if (byClaraId) {
      if (!byClaraId.isActive) throw new ClaraSsoLoginError("local_account_disabled");
      return byClaraId;
    }

    if (!claims.email) throw new ClaraSsoLoginError("id_token_missing_email");

    const byEmail = await this.prisma.user.findFirst({ where: { email: claims.email } });

    if (byEmail) {
      if (byEmail.claraUserId && byEmail.claraUserId !== claims.sub) {
        await this.securityEvents.record({
          type: "SSO_LOGIN_FAILED",
          severity: "HIGH",
          organizationId: byEmail.organizationId,
          actorId: byEmail.id,
          ipAddress: meta.ipAddress,
          details: { reason: "clara_identity_conflict" },
        });
        throw new ClaraSsoLoginError("clara_identity_conflict");
      }
      if (!byEmail.isActive) throw new ClaraSsoLoginError("local_account_disabled");

      const linked = await this.prisma.user.update({ where: { id: byEmail.id }, data: { claraUserId: claims.sub } });
      await this.auditLog.record({
        organizationId: linked.organizationId,
        actorType: "USER",
        actorId: linked.id,
        action: "auth.sso.clara_identity_linked",
        resourceType: "user",
        resourceId: linked.id,
        ipAddress: meta.ipAddress,
      });
      return linked;
    }

    return this.provisionUser(cfg, claims, meta);
  }

  /** First-ever login for this Clara identity, and no existing Live Chat account matched by email — create one. */
  private async provisionUser(cfg: ClaraSsoConfig, claims: ClaraIdTokenClaims, meta: RequestMeta): Promise<User> {
    const roleSlug = cfg.roleMap[claims.role];
    if (!roleSlug) {
      // CRM_SSO_ALLOWED_ROLES let this role through but CRM_SSO_ROLE_MAP has no entry for it —
      // a configuration gap, not something safe to guess a role for.
      await this.securityEvents.record({
        type: "SSO_LOGIN_FAILED",
        severity: "HIGH",
        ipAddress: meta.ipAddress,
        details: { reason: "role_not_mapped", claraRole: claims.role },
      });
      throw new ClaraSsoLoginError("role_not_mapped");
    }

    const organization = await this.prisma.organization.findUnique({ where: { slug: cfg.defaultOrganizationSlug } });
    if (!organization) {
      throw new ClaraSsoLoginError("default_organization_not_found");
    }

    const role = await this.prisma.role.findUnique({
      where: { organizationId_slug: { organizationId: organization.id, slug: roleSlug } },
    });
    if (!role) {
      await this.securityEvents.record({
        type: "SSO_LOGIN_FAILED",
        severity: "HIGH",
        organizationId: organization.id,
        ipAddress: meta.ipAddress,
        details: { reason: "mapped_role_not_seeded", roleSlug },
      });
      throw new ClaraSsoLoginError("mapped_role_not_seeded");
    }

    // No local password is ever set for an SSO-provisioned account — a random, never-shared
    // value locks out email/password login until someone deliberately sets a real password via
    // "forgot password".
    const passwordHash = await hash(nanoid(64));

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: claims.email!,
          name: claims.name ?? claims.email!,
          passwordHash,
          isActive: true,
          claraUserId: claims.sub,
        },
      });
      await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
      if (roleSlug === "cs_agent") {
        await tx.agentProfile.create({ data: { userId: created.id } });
      }
      return created;
    });

    await this.auditLog.record({
      organizationId: organization.id,
      actorType: "USER",
      actorId: user.id,
      action: "auth.sso.clara_account_provisioned",
      resourceType: "user",
      resourceId: user.id,
      afterData: { email: user.email, roleSlug, claraRole: claims.role },
      ipAddress: meta.ipAddress,
    });

    return user;
  }
}
