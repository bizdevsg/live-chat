import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeTtlSeconds: number;
  tokenTtlSeconds: number;
  allowedRoles: Set<string>;
}

@Injectable()
export class OidcProviderConfigService {
  constructor(private readonly config: ConfigService) {}

  resolve(): OidcProviderConfig {
    const issuer = this.config
      .get<string>("LIVE_CHAT_OIDC_ISSUER")
      ?.trim()
      .replace(/\/$/, "");
    const clientSecret = this.config
      .get<string>("LIVE_CHAT_OIDC_CLIENT_SECRET")
      ?.trim();
    const redirectUri = this.config
      .get<string>("LIVE_CHAT_OIDC_REDIRECT_URI")
      ?.trim();
    if (!issuer || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        "Login Clara dengan akun Live Chat belum dikonfigurasi.",
      );
    }
    if (clientSecret.length < 32)
      throw new Error("LIVE_CHAT_OIDC_CLIENT_SECRET minimal 32 karakter.");
    if (
      new Set([
        this.config.get("JWT_ACCESS_SECRET"),
        this.config.get("JWT_REFRESH_SECRET"),
      ]).has(clientSecret)
    ) {
      throw new Error(
        "LIVE_CHAT_OIDC_CLIENT_SECRET harus berbeda dari secret autentikasi lain.",
      );
    }
    const production = this.config.get("NODE_ENV") === "production";
    if (
      (production && !issuer.startsWith("https://")) ||
      (production && !redirectUri.startsWith("https://"))
    ) {
      throw new Error(
        "Issuer dan redirect URI OIDC wajib memakai HTTPS di production.",
      );
    }
    return {
      issuer,
      clientId:
        this.config.get<string>("LIVE_CHAT_OIDC_CLIENT_ID") ?? "clara-crm",
      clientSecret,
      redirectUri,
      codeTtlSeconds:
        this.config.get<number>("LIVE_CHAT_OIDC_CODE_TTL_SECONDS") ?? 120,
      tokenTtlSeconds:
        this.config.get<number>("LIVE_CHAT_OIDC_TOKEN_TTL_SECONDS") ?? 300,
      allowedRoles: new Set(
        (
          this.config.get<string>("LIVE_CHAT_OIDC_ALLOWED_ROLES") ??
          "cs_agent,supervisor,admin,super_admin"
        )
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean),
      ),
    };
  }
}
