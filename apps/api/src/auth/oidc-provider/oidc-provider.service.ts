import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type Redis from "ioredis";
import jwt from "jsonwebtoken";
import type { JwtAccessPayload } from "@solidchat/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS_CLIENT } from "../../redis/redis.module";
import { OidcProviderConfigService } from "./oidc-provider.config";

interface AuthorizationCodeRecord {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
  scope: string;
}

export interface OidcTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  id_token: string;
}

@Injectable()
export class OidcProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardJwt: JwtService,
    private readonly appConfig: ConfigService,
    private readonly oidcConfig: OidcProviderConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  discovery() {
    const config = this.oidcConfig.resolve();
    return {
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/oauth/authorize`,
      token_endpoint: `${config.issuer}/oauth/token`,
      userinfo_endpoint: `${config.issuer}/oauth/userinfo`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"],
      scopes_supported: ["openid", "profile", "email"],
      token_endpoint_auth_methods_supported: ["client_secret_basic"],
      code_challenge_methods_supported: ["S256"],
    };
  }

  async authorize(
    request: Request,
    query: Record<string, string | undefined>,
  ): Promise<string> {
    const config = this.oidcConfig.resolve();
    this.validateAuthorizeQuery(config, query);
    const userId = await this.authenticateDashboardSession(request);
    if (!userId) {
      const returnTo = `${config.issuer}/oauth/authorize?${new URLSearchParams(query as Record<string, string>).toString()}`;
      const appUrl = (
        this.appConfig.get<string>("APP_URL") ?? "http://localhost:3000"
      ).replace(/\/$/, "");
      return `${appUrl}/login?returnTo=${encodeURIComponent(returnTo)}`;
    }

    const identity = await this.loadActiveIdentity(userId, config.allowedRoles);
    if (!identity)
      throw new UnauthorizedException(
        "Akun tidak aktif atau tidak diizinkan untuk SSO.",
      );
    const code = randomBytes(32).toString("base64url");
    const record: AuthorizationCodeRecord = {
      userId,
      clientId: query.client_id!,
      redirectUri: query.redirect_uri!,
      codeChallenge: query.code_challenge!,
      nonce: query.nonce!,
      scope: query.scope!,
    };
    await this.redis.set(
      this.codeKey(code),
      JSON.stringify(record),
      "EX",
      config.codeTtlSeconds,
    );
    const redirect = new URL(config.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", query.state!);
    return redirect.toString();
  }

  async exchangeCode(
    authorization: string | undefined,
    body: Record<string, string | undefined>,
  ): Promise<OidcTokenResponse> {
    const config = this.oidcConfig.resolve();
    this.verifyClientAuthentication(
      authorization,
      config.clientId,
      config.clientSecret,
    );
    if (
      body.grant_type !== "authorization_code" ||
      !body.code ||
      !body.redirect_uri ||
      !body.code_verifier
    ) {
      throw new BadRequestException("invalid_grant");
    }

    const rawRecord = await this.redis.getdel(this.codeKey(body.code));
    if (!rawRecord) throw new BadRequestException("invalid_grant");
    const record = JSON.parse(rawRecord) as AuthorizationCodeRecord;
    const actualChallenge = createHash("sha256")
      .update(body.code_verifier)
      .digest("base64url");
    if (
      record.clientId !== config.clientId ||
      record.redirectUri !== body.redirect_uri ||
      !this.safeEqual(record.codeChallenge, actualChallenge)
    ) {
      throw new BadRequestException("invalid_grant");
    }

    const identity = await this.loadActiveIdentity(
      record.userId,
      config.allowedRoles,
    );
    if (!identity) throw new BadRequestException("invalid_grant");
    const now = Math.floor(Date.now() / 1_000);
    const claims = {
      iss: config.issuer,
      aud: config.clientId,
      sub: identity.id,
      email: identity.email,
      name: identity.name,
      role: identity.role,
      organizationId: identity.organizationId,
      isActive: true,
      ...(identity.claraUserId ? { claraUserId: identity.claraUserId } : {}),
      nonce: record.nonce,
      iat: now,
      exp: now + config.tokenTtlSeconds,
      jti: randomBytes(16).toString("base64url"),
    };
    const idToken = jwt.sign(claims, config.clientSecret, {
      algorithm: "HS256",
    });
    const accessToken = randomBytes(32).toString("base64url");
    await this.redis.set(
      this.accessTokenKey(accessToken),
      JSON.stringify({ ...claims, scope: record.scope }),
      "EX",
      config.tokenTtlSeconds,
    );
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: config.tokenTtlSeconds,
      scope: record.scope,
      id_token: idToken,
    };
  }

  async userinfo(authorization: string | undefined) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!token) throw new UnauthorizedException("invalid_token");
    const raw = await this.redis.get(this.accessTokenKey(token));
    if (!raw) throw new UnauthorizedException("invalid_token");
    const claims = JSON.parse(raw) as Record<string, unknown>;
    const identity = await this.loadActiveIdentity(
      String(claims.sub),
      this.oidcConfig.resolve().allowedRoles,
    );
    if (!identity) throw new UnauthorizedException("invalid_token");
    const { nonce: _nonce, scope: _scope, ...publicClaims } = claims;
    return publicClaims;
  }

  private validateAuthorizeQuery(
    config: ReturnType<OidcProviderConfigService["resolve"]>,
    query: Record<string, string | undefined>,
  ) {
    const required = [
      "client_id",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
      "nonce",
      "code_challenge",
      "code_challenge_method",
    ];
    if (required.some((key) => !query[key]))
      throw new BadRequestException("invalid_request");
    const scopes = new Set(query.scope!.split(/\s+/));
    if (
      query.client_id !== config.clientId ||
      query.redirect_uri !== config.redirectUri ||
      query.response_type !== "code" ||
      query.code_challenge_method !== "S256" ||
      !/^[A-Za-z0-9_-]{43}$/.test(query.code_challenge!) ||
      !scopes.has("openid") ||
      !scopes.has("profile") ||
      !scopes.has("email")
    ) {
      throw new BadRequestException("invalid_request");
    }
  }

  private async authenticateDashboardSession(
    request: Request,
  ): Promise<string | null> {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice(7)
      : request.cookies?.access_token;
    if (!token) return null;
    try {
      const payload = await this.dashboardJwt.verifyAsync<JwtAccessPayload>(
        token,
        {
          secret: this.appConfig.get<string>("JWT_ACCESS_SECRET"),
        },
      );
      if (payload.type !== "access") return null;
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });
      return session && !session.revokedAt && session.expiresAt > new Date()
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  }

  private async loadActiveIdentity(userId: string, allowedRoles: Set<string>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user?.isActive) return null;
    const precedence = ["super_admin", "admin", "supervisor", "cs_agent"];
    const role = precedence.find((candidate) =>
      user.roles.some(
        (entry) => entry.role.slug === candidate && allowedRoles.has(candidate),
      ),
    );
    if (!role) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      organizationId: user.organizationId,
      claraUserId: user.claraUserId,
    };
  }

  private verifyClientAuthentication(
    authorization: string | undefined,
    expectedId: string,
    expectedSecret: string,
  ) {
    if (!authorization?.startsWith("Basic "))
      throw new UnauthorizedException("invalid_client");
    let decoded = "";
    try {
      decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    } catch {
      throw new UnauthorizedException("invalid_client");
    }
    const separator = decoded.indexOf(":");
    if (
      separator < 0 ||
      decoded.slice(0, separator) !== expectedId ||
      !this.safeEqual(decoded.slice(separator + 1), expectedSecret)
    ) {
      throw new UnauthorizedException("invalid_client");
    }
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private codeKey(code: string) {
    return `oidc:code:${createHash("sha256").update(code).digest("hex")}`;
  }

  private accessTokenKey(token: string) {
    return `oidc:access:${createHash("sha256").update(token).digest("hex")}`;
  }
}
