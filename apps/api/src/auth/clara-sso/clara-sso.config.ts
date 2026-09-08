import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ErrorCode } from "@solidchat/shared";
import { ApiException } from "../../common/errors/api.exception";

export interface ClaraSsoConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedRoles: string[];
  allowedOrganizationId?: string;
  stateTtlSeconds: number;
  postLoginPath: string;
  appUrl: string;
  /** Live Chat `organizations.slug` new auto-provisioned agents are created under. */
  defaultOrganizationSlug: string;
  /** Clara role -> Live Chat role slug, e.g. { sales: "cs_agent", manager: "supervisor" }. */
  roleMap: Record<string, string>;
}

/**
 * Reads CRM_SSO_* once per request and fails loudly with a clean 503 if the feature isn't fully
 * configured yet — Tim Clara's client secret and this Live Chat deployment's exact redirect URI
 * are both still pending (spec Bagian B, "Belum tersedia"), so this guards against a half-wired
 * login button reaching real users before that handshake is done.
 */
@Injectable()
export class ClaraSsoConfigService {
  constructor(private readonly config: ConfigService) {}

  resolve(): ClaraSsoConfig {
    const issuer = this.config.get<string>("CRM_SSO_ISSUER");
    const clientId = this.config.get<string>("CRM_SSO_CLIENT_ID");
    const clientSecret = this.config.get<string>("CRM_SSO_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("CRM_SSO_REDIRECT_URI");

    if (!issuer || !clientId || !clientSecret || !redirectUri) {
      throw new ApiException(
        ErrorCode.SSO_NOT_CONFIGURED,
        "Login dengan Clara belum dikonfigurasi di server ini.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const allowedRoles = (this.config.get<string>("CRM_SSO_ALLOWED_ROLES") ?? "sales,manager,head,superadmin")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);

    const roleMap = this.parseRoleMap(this.config.get<string>("CRM_SSO_ROLE_MAP") ?? "");

    return {
      issuer: issuer.replace(/\/+$/, ""),
      clientId,
      clientSecret,
      redirectUri,
      allowedRoles,
      allowedOrganizationId: this.config.get<string>("CRM_SSO_ALLOWED_ORGANIZATION_ID") || undefined,
      stateTtlSeconds: this.config.get<number>("CRM_SSO_STATE_TTL_SECONDS") ?? 600,
      postLoginPath: this.config.get<string>("CRM_SSO_POST_LOGIN_PATH") ?? "/dashboard",
      appUrl: this.config.get<string>("APP_URL") ?? "http://localhost:3000",
      defaultOrganizationSlug: this.config.get<string>("CRM_SSO_DEFAULT_ORGANIZATION_SLUG") ?? "solid-gold",
      roleMap,
    };
  }

  private parseRoleMap(raw: string): Record<string, string> {
    const map: Record<string, string> = {};
    for (const pair of raw.split(",")) {
      const [claraRole, liveChatRole] = pair.split(":").map((part) => part.trim());
      if (claraRole && liveChatRole) map[claraRole] = liveChatRole;
    }
    return map;
  }
}
