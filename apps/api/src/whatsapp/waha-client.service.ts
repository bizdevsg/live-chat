import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface WahaSession {
  name: string;
  status?: string;
  me?: { id?: string; pushName?: string } | null;
}

export interface WahaContact {
  id?: string;
  number?: string;
  name?: string;
  pushname?: string;
  shortName?: string;
}

export interface WahaMessage {
  id?: string;
  timestamp?: number;
  from?: string;
  to?: string;
  fromMe?: boolean;
  body?: string;
  hasMedia?: boolean;
  media?: { url?: string; mimetype?: string; filename?: string | null; error?: string | null } | null;
  ack?: number;
  ackName?: string;
}

export interface WahaChatOverview {
  id?: string;
  name?: string;
  picture?: string | null;
  lastMessage?: WahaMessage | null;
  _chat?: Record<string, unknown>;
}

export interface WahaQrResponse {
  mimetype: string;
  data: string;
}

@Injectable()
export class WahaClientService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>("WAHA_API_URL")?.trim() && this.config.get<string>("WAHA_API_KEY")?.trim());
  }

  async ensureSession(name: string, engine: string) {
    this.assertConfigured();
    const webhookUrl = this.config.get<string>("WAHA_WEBHOOK_URL")?.trim();
    const hmacKey = this.config.get<string>("WAHA_WEBHOOK_HMAC_KEY")?.trim();
    if (!webhookUrl || !hmacKey) {
      throw new ServiceUnavailableException("WAHA_WEBHOOK_URL dan WAHA_WEBHOOK_HMAC_KEY wajib dikonfigurasi.");
    }

    const payload = {
      name,
      engine,
      config: {
        noweb: {
          store: { enabled: true, fullSync: true },
        },
        webhooks: [
          {
            url: webhookUrl,
            events: ["message", "message.ack", "session.status"],
            hmac: { key: hmacKey },
          },
        ],
      },
    };

    const existing = await this.request<WahaSession | null>(`/api/sessions/${encodeURIComponent(name)}`, { method: "GET" }, [404]);
    if (existing) {
      await this.request(`/api/sessions/${encodeURIComponent(name)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await this.request("/api/sessions", { method: "POST", body: JSON.stringify(payload) });
    }
    await this.request(`/api/sessions/${encodeURIComponent(name)}/start`, { method: "POST" });
    return this.getSession(name);
  }

  getSession(name: string) {
    return this.request<WahaSession>(`/api/sessions/${encodeURIComponent(name)}`, { method: "GET" });
  }

  getQr(name: string) {
    return this.request<WahaQrResponse>(
      `/api/${encodeURIComponent(name)}/auth/qr?format=image`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
  }

  async logout(name: string) {
    await this.request(`/api/sessions/${encodeURIComponent(name)}/logout`, { method: "POST" }, [404, 422]);
  }

  sendText(session: string, chatId: string, text: string) {
    return this.request<Record<string, unknown>>("/api/sendText", {
      method: "POST",
      body: JSON.stringify({ session, chatId, text }),
    });
  }

  getChatsOverview(session: string, limit = 100, offset = 0) {
    return this.request<WahaChatOverview[]>(
      `/api/${encodeURIComponent(session)}/chats/overview?limit=${limit}&offset=${offset}`,
      { method: "GET" },
    );
  }

  getChatMessages(session: string, chatId: string, limit = 100, offset = 0) {
    return this.request<WahaMessage[]>(
      `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}&offset=${offset}&downloadMedia=true`,
      { method: "GET" },
    );
  }

  getContact(session: string, chatId: string) {
    return this.request<WahaContact>(
      `/api/contacts?contactId=${encodeURIComponent(chatId)}&session=${encodeURIComponent(session)}`,
      { method: "GET" },
      [404],
    );
  }

  getContactPicture(session: string, chatId: string) {
    return this.request<{ profilePictureURL?: string | null }>(
      `/api/contacts/profile-picture?contactId=${encodeURIComponent(chatId)}&session=${encodeURIComponent(session)}`,
      { method: "GET" },
      [404],
    );
  }

  markChatRead(session: string, chatId: string) {
    return this.request<{ ids?: string[] }>(
      `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages/read`,
      { method: "POST", body: "{}" },
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new ServiceUnavailableException("Integrasi WAHA belum dikonfigurasi pada server.");
  }

  private async request<T = unknown>(path: string, init: RequestInit, toleratedStatuses: number[] = []): Promise<T | null> {
    this.assertConfigured();
    const baseUrl = this.config.get<string>("WAHA_API_URL")!.replace(/\/$/, "");
    const apiKey = this.config.get<string>("WAHA_API_KEY")!;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          ...init.headers,
        },
      });
    } catch (error) {
      throw new BadGatewayException(`WAHA tidak dapat dihubungi: ${error instanceof Error ? error.message : "network error"}`);
    }

    if (toleratedStatuses.includes(response.status)) return null;
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500);
      throw new BadGatewayException(`WAHA merespons ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    if (response.status === 204) return null;
    return (await response.json().catch(() => null)) as T | null;
  }
}
