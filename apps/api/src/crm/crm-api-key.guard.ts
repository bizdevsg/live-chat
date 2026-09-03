import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { ForbiddenApiException, UnauthorizedApiException } from "../common/errors/api.exception";

export interface CrmCredential {
  /** Server-to-server API key value (never logged, never echoed back). */
  key: string;
  /** `Site.siteKey` values this credential may read. Empty/absent = every site (legacy, discouraged — Kebutuhan API Live Chat §4.1). */
  siteIds?: string[];
  /** Free-text label for audit logging only — never returned to the caller. */
  label?: string;
}

export interface CrmRequestScope {
  credential: CrmCredential;
  /** true when this credential is not scoped to specific sites (legacy single-key mode). */
  hasFullAccess: boolean;
}

/**
 * Authenticates Clara's server-to-server conversation-sync calls (§4) and resolves which
 * site(s) the presented key may read (§4.1). Configure scoped credentials via CRM_API_KEYS:
 *
 *   CRM_API_KEYS='[{"key":"...","siteIds":["solid-gold-main"],"label":"clara-prod"}]'
 *
 * Falls back to the single legacy CRM_INBOUND_API_KEY / CRM_API_KEY (full access, every site)
 * when CRM_API_KEYS is not set, for backward compatibility with single-site deployments.
 */
@Injectable()
export class CrmApiKeyGuard implements CanActivate {
  private readonly logger = new Logger("CrmApiKeyGuard");
  private credentials: CrmCredential[] | null = null;

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.enforceIpAllowlist(request);

    const presented = this.extractApiKey(request.headers as Record<string, string | string[] | undefined>);
    if (!presented) {
      throw new UnauthorizedApiException("API key tidak ditemukan. Sertakan header Authorization: Bearer <API_KEY>.");
    }

    const credentials = this.loadCredentials();
    if (credentials.length === 0) {
      throw new UnauthorizedApiException("CRM inbound API key belum dikonfigurasi di server.");
    }

    const matched = credentials.find((credential) => this.matches(credential.key, presented));
    if (!matched) {
      throw new UnauthorizedApiException("CRM API key tidak valid.");
    }

    const scope: CrmRequestScope = {
      credential: matched,
      hasFullAccess: !matched.siteIds || matched.siteIds.length === 0,
    };
    (request as Request & { crmScope: CrmRequestScope }).crmScope = scope;
    return true;
  }

  private loadCredentials(): CrmCredential[] {
    if (this.credentials) return this.credentials;

    const raw = this.config.get<string>("CRM_API_KEYS");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CrmCredential[];
        this.credentials = parsed
          .filter((entry) => typeof entry?.key === "string" && entry.key.trim().length > 0)
          .map((entry) => ({ key: entry.key.trim(), siteIds: entry.siteIds?.filter(Boolean), label: entry.label }));
        return this.credentials;
      } catch {
        this.logger.error("CRM_API_KEYS tidak valid (bukan JSON array) — kredensial CRM diabaikan.");
        this.credentials = [];
        return this.credentials;
      }
    }

    const legacyKey = this.config.get<string>("CRM_INBOUND_API_KEY") ?? this.config.get<string>("CRM_API_KEY");
    this.credentials = legacyKey ? [{ key: legacyKey, label: "legacy-full-access" }] : [];
    return this.credentials;
  }

  private enforceIpAllowlist(request: Request): void {
    const raw = this.config.get<string>("CRM_ALLOWED_IPS");
    if (!raw) return;

    const allowlist = raw.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (allowlist.length === 0) return;

    const requestIp = request.ip ?? request.socket?.remoteAddress ?? "";
    const normalizedIp = requestIp.replace(/^::ffff:/, "");
    if (!allowlist.includes(normalizedIp)) {
      throw new ForbiddenApiException("Alamat IP tidak diizinkan untuk mengakses CRM API.");
    }
  }

  private extractApiKey(headers: Record<string, string | string[] | undefined>): string | undefined {
    const authorization = headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      const token = authorization.slice(7).trim();
      if (token) return token;
    }

    const xApiKey = headers["x-api-key"];
    if (typeof xApiKey === "string" && xApiKey.trim()) return xApiKey.trim();

    return undefined;
  }

  private matches(expected: string, presented: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const presentedBuffer = Buffer.from(presented);
    if (expectedBuffer.length !== presentedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, presentedBuffer);
  }
}
