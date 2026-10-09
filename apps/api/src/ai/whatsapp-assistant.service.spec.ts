import { AiIntent } from "@solidchat/shared";
import { WhatsAppAssistantService } from "./whatsapp-assistant.service";

describe("WhatsAppAssistantService", () => {
  function buildService(overrides: { intent?: string; confidence?: number; sensitive?: boolean } = {}) {
    const provider = {
      classifyIntent: jest.fn().mockResolvedValue({
        intent: overrides.intent ?? AiIntent.GENERAL_INQUIRY,
        confidence: 0.9,
        sentiment: "NEUTRAL",
        containsSensitiveData: overrides.sensitive ?? false,
        promptInjectionDetected: false,
        retrievalQuery: "cara membuka akun",
      }),
      generateSuggestedReply: jest.fn().mockResolvedValue({
        reply: "Silakan mulai melalui Aplikasi Solid.",
        confidence: overrides.confidence ?? 0.9,
        sources: [{ documentId: "doc-1", chunkId: "chunk-1", title: "Cara Daftar", version: 1, score: 0.8 }],
      }),
    };
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue({
          id: "site-1",
          name: "Solid Gold",
          aiName: "Solid Prime AI",
          language: "id",
          organization: { name: "PT Solid Gold Berjangka" },
        }),
      },
    };
    const retrieval = {
      retrieveForAgent: jest.fn().mockResolvedValue([
        { documentId: "doc-1", chunkId: "chunk-1", title: "Cara Daftar", version: 1, content: "Daftar melalui Aplikasi Solid." },
      ]),
    };
    const factory = {
      getProviderForSite: jest.fn().mockResolvedValue({ provider, config: { id: "config-1" } }),
    };

    const service = new WhatsAppAssistantService(prisma as never, retrieval as never, factory as never);
    return { service, provider, prisma, retrieval };
  }

  const dto = {
    prompt: "Buat jawaban yang singkat dan ramah.",
    systemPrompt: "Prompt khusus extension",
    conversationTitle: "Budi",
    messages: [{ senderType: "CUSTOMER" as const, content: "Bagaimana cara daftar?", createdAt: "2026-10-07T02:00:00.000Z" }],
  };

  it("grounds the reply with agent-visible knowledge and forwards the operator prompt", async () => {
    const { service, provider, retrieval } = buildService();

    const result = await service.createReply(dto, "site-1");

    expect(retrieval.retrieveForAgent).toHaveBeenCalledWith("site-1", "cara membuka akun");
    expect(provider.generateSuggestedReply).toHaveBeenCalledWith(
      expect.objectContaining({
        agentDraft: dto.prompt,
        agentName: "Tim Customer Service",
        evidence: expect.arrayContaining([expect.objectContaining({ title: "Cara Daftar" })]),
        systemPrompt: "Prompt khusus extension",
      }),
    );
    expect(result.canAutoReply).toBe(true);
    expect(result.sources).toHaveLength(1);
  });

  it("keeps sensitive intents in draft-only mode", async () => {
    const { service } = buildService({ intent: AiIntent.WITHDRAWAL });

    const result = await service.createReply(dto);

    expect(result.canAutoReply).toBe(false);
    expect(result.autoReplyBlockedReason).toBe("INTENT_WITHDRAWAL");
    expect(result.reply).toContain("Aplikasi Solid");
  });

  it("disables auto reply when model confidence is low", async () => {
    const { service } = buildService({ confidence: 0.4 });

    const result = await service.createReply(dto);

    expect(result.canAutoReply).toBe(false);
    expect(result.autoReplyBlockedReason).toBe("LOW_CONFIDENCE");
  });
});
