import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ClaraWebhookSiteConfig {
  siteKey: string;
  claraSiteId: string;
  url: string;
  secret: string;
}

interface RawSiteConfig {
  siteKey?: unknown;
  claraSiteId?: unknown;
  url?: unknown;
  secret?: unknown;
  enabled?: unknown;
}

@Injectable()
export class ClaraWebhookConfigService {
  private readonly sites: Map<string, ClaraWebhookSiteConfig>;

  constructor(private readonly config: ConfigService) {
    this.sites = this.parseSites();
  }

  forSite(siteKey: string): ClaraWebhookSiteConfig | null {
    return this.sites.get(siteKey) ?? null;
  }

  private parseSites(): Map<string, ClaraWebhookSiteConfig> {
    const raw = this.config.get<string>("CLARA_WEBHOOK_SITE_CONFIGS")?.trim();
    if (!raw) return new Map();

    let entries: RawSiteConfig[];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("must be an array");
      entries = parsed as RawSiteConfig[];
    } catch {
      throw new Error(
        "CLARA_WEBHOOK_SITE_CONFIGS harus berupa JSON array yang valid.",
      );
    }

    const defaultUrl = this.config.get<string>("CLARA_WEBHOOK_URL")?.trim();
    const result = new Map<string, ClaraWebhookSiteConfig>();
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      const siteKey =
        typeof entry.siteKey === "string" ? entry.siteKey.trim() : "";
      const claraSiteId =
        typeof entry.claraSiteId === "string" ? entry.claraSiteId.trim() : "";
      const secret = typeof entry.secret === "string" ? entry.secret : "";
      const url =
        (typeof entry.url === "string" ? entry.url : defaultUrl)?.trim() ?? "";
      if (
        !siteKey ||
        !/^[A-Za-z0-9._-]{1,100}$/.test(claraSiteId) ||
        secret.length < 32 ||
        !this.isHttpUrl(url)
      ) {
        throw new Error(
          `Konfigurasi webhook Clara tidak valid untuk site ${siteKey || "<kosong>"}.`,
        );
      }
      if (result.has(siteKey))
        throw new Error(
          `Konfigurasi webhook Clara duplikat untuk site ${siteKey}.`,
        );
      result.set(siteKey, {
        siteKey,
        claraSiteId,
        secret,
        url: url.replace(/\/$/, ""),
      });
    }
    return result;
  }

  private isHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return (
        parsed.protocol === "https:" ||
        (this.config.get("NODE_ENV") !== "production" &&
          parsed.protocol === "http:")
      );
    } catch {
      return false;
    }
  }
}
