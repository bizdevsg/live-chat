import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { widgetStorage } from "../lib/storage";

export interface SiteConfig {
  siteId: string;
  name: string;
  aiName: string;
  logoUrl: string | null;
  widgetColor: string;
  offlineMessage: string;
  language: string;
  settings: {
    widgetEnabled: boolean;
    aiEnabled: boolean;
    humanChatEnabled: boolean;
    preChatFormEnabled: boolean;
    showAgentButton: boolean;
    allowAttachments: boolean;
    ratingFormEnabled: boolean;
  } | null;
}

interface SessionResult {
  visitorToken: string;
  site: SiteConfig;
}

function getQueryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function useWidgetSession() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(widgetStorage.getVisitorToken());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const siteId = getQueryParam("siteId");
    if (!siteId) {
      setError("data-site-id tidak ditemukan pada widget.js.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function bootstrap() {
      try {
        const visitorId = widgetStorage.getOrCreateVisitorId();
        const result = await api.post<SessionResult>("/api/v1/widget/session", {
          siteId,
          visitorId,
          pageUrl: document.referrer || window.location.href,
          pageTitle: document.title,
          language: getQueryParam("language") ?? navigator.language.slice(0, 2),
          referrer: document.referrer || undefined,
          device: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        });
        if (cancelled) return;
        widgetStorage.setVisitorToken(result.visitorToken);
        setVisitorToken(result.visitorToken);
        setConfig(result.site);
      } catch {
        if (!cancelled) setError("Tidak dapat terhubung ke server SolidChat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, visitorToken, loading, error };
}
