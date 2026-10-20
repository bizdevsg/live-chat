import { createHmac } from "node:crypto";
import {
  ClaraWebhookService,
  PermanentClaraWebhookError,
  signClaraWebhookBody,
} from "./clara-webhook.service";

describe("ClaraWebhookService", () => {
  const secret = "s".repeat(32);
  const config = {
    siteKey: "main",
    claraSiteId: "website-main",
    url: "https://crm.example/webhook",
    secret,
  };
  const conversation = {
    id: "conv-1",
    assignedAgentId: "agent-1",
    channel: "WIDGET",
    site: { siteKey: "main" },
    customer: { name: "Budi", email: "budi@example.com" },
    leads: [
      {
        phone: "+62812",
        city: "Jakarta",
        purpose: "Trading",
        productInterest: "Gold",
        consentGiven: false,
      },
    ],
    messages: [
      {
        id: "msg-2",
        senderType: "AGENT",
        senderId: "agent-1",
        content: "raw agent",
        contentSanitized: "Halo",
        createdAt: new Date("2026-10-19T10:01:00Z"),
        attachments: [],
      },
      {
        id: "msg-1",
        senderType: "CUSTOMER",
        senderId: null,
        content: "Pertanyaan",
        contentSanitized: null,
        createdAt: new Date("2026-10-19T10:00:00Z"),
        attachments: [{ fileName: "invoice.pdf" }],
      },
    ],
  };

  function createService(status = 200, retryAfter?: string) {
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue(structuredClone(conversation)),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: "agent-1",
              name: "Andi",
              claraUserId: "8a1d0f7c-1d45-4c0a-9058-2d2b58544e70",
            },
          ]),
      },
    };
    const configs = { forSite: jest.fn().mockReturnValue(config) };
    const queue = { getJob: jest.fn(), add: jest.fn() };
    const response = {
      status,
      headers: { get: jest.fn().mockReturnValue(retryAfter ?? null) },
    };
    global.fetch = jest.fn().mockResolvedValue(response) as typeof fetch;
    return {
      service: new ClaraWebhookService(
        prisma as never,
        configs as never,
        queue as never,
      ),
      prisma,
      queue,
    };
  }

  afterEach(() => jest.restoreAllMocks());

  it("matches Clara's published HMAC test vector byte-for-byte", () => {
    const body =
      '{"event":"conversation.upserted","eventId":"evt-vektor","occurredAt":"2026-10-19T10:00:00Z","conversation":{"id":"conv-vektor","messages":[{"id":"msg-1","senderType":"customer","senderName":"Budi","text":"Halo, saya ingin bertanya.","sentAt":"2026-10-19T10:00:00Z"}]}}';
    expect(
      signClaraWebhookBody(
        "contoh-secret-hanya-untuk-uji-tanda-tangan-32-karakter",
        "1790000000",
        body,
      ),
    ).toBe(
      "sha256=14a944dc792a910d143f6661c342d3249845e89f801f452689e7fe2ac05815f3",
    );
  });

  it("signs the exact serialized body and maps a sanitized full transcript", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_790_000_000_000);
    const { service } = createService();
    await service.deliver({
      conversationId: "conv-1",
      eventId: "evt-1",
      occurredAt: "2026-10-19T10:05:00Z",
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = String(init.body);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Clara-Signature"]).toBe(
      `sha256=${createHmac("sha256", secret).update(`1790000000.${body}`).digest("hex")}`,
    );
    const payload = JSON.parse(body);
    expect(payload.conversation.assignee).toEqual({
      claraUserId: "8a1d0f7c-1d45-4c0a-9058-2d2b58544e70",
    });
    expect(payload.conversation.messages).toEqual([
      expect.objectContaining({
        id: "msg-1",
        senderType: "customer",
        text: "Pertanyaan\n[Attachment: invoice.pdf]",
      }),
      expect.objectContaining({
        id: "msg-2",
        senderType: "sales",
        senderName: "Andi",
        text: "Halo",
      }),
    ]);
  });

  it("does not retry permanent contract errors", async () => {
    const { service } = createService(422);
    await expect(
      service.deliver({
        conversationId: "conv-1",
        eventId: "evt-2",
        occurredAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(PermanentClaraWebhookError);
  });

  it("carries Retry-After for retryable responses", async () => {
    const { service } = createService(429, "30");
    await expect(
      service.deliver({
        conversationId: "conv-1",
        eventId: "evt-3",
        occurredAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ retryAfterMs: 30_000 });
  });
});
