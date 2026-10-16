import { AiIntent } from "@solidchat/shared";
import { WhatsAppAssistantService } from "./whatsapp-assistant.service";

describe("WhatsAppAssistantService", () => {
  function buildService(overrides: { intent?: string; confidence?: number; sensitive?: boolean } = {}) {
    const provider = {
      name: "openai",
      consumeTokenUsage: jest.fn().mockReturnValue({ inputTokens: 10, outputTokens: 2 }),
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
          organizationId: "org-1",
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
      getProviderForSite: jest.fn().mockResolvedValue({ provider, config: { id: "config-1" }, model: "gpt-4o-mini" }),
    };
    const aiRuns = { record: jest.fn().mockResolvedValue({ id: "run-1" }) };
    const assistantPrompt = { getPrompt: jest.fn().mockReturnValue("Prompt extension dari backend") };

    const service = new WhatsAppAssistantService(
      prisma as never,
      retrieval as never,
      factory as never,
      aiRuns as never,
      assistantPrompt as never,
    );
    return { service, provider, prisma, retrieval, aiRuns, assistantPrompt };
  }

  const dto = {
    prompt: "Buat jawaban yang singkat dan ramah.",
    conversationTitle: "Budi",
    messages: [{ senderType: "CUSTOMER" as const, content: "Bagaimana cara daftar?", createdAt: "2026-10-07T02:00:00.000Z" }],
  };

  it("grounds the reply with agent-visible knowledge and forwards the operator prompt", async () => {
    const { service, provider, retrieval } = buildService();

    const result = await service.createReply(dto, "site-1");

    expect(retrieval.retrieveForAgent).toHaveBeenCalledWith(
      "site-1",
      expect.stringContaining("Topik utama: cara membuka akun"),
      expect.objectContaining({ organizationId: "org-1", siteId: "site-1", source: "EXTENSION" }),
    );
    expect(retrieval.retrieveForAgent).toHaveBeenCalledWith(
      "site-1",
      expect.stringContaining(`Kebutuhan agent: ${dto.prompt}`),
      expect.any(Object),
    );
    expect(retrieval.retrieveForAgent).toHaveBeenCalledWith(
      "site-1",
      expect.stringContaining("CUSTOMER: Bagaimana cara daftar?"),
      expect.any(Object),
    );
    expect(provider.generateSuggestedReply).toHaveBeenCalledWith(
      expect.objectContaining({
        agentDraft: dto.prompt,
        agentName: "Tim Customer Service",
        evidence: expect.arrayContaining([expect.objectContaining({ title: "Cara Daftar" })]),
        systemPrompt: "Prompt extension dari backend",
      }),
    );
    expect(result.canAutoReply).toBe(true);
    expect(result.sources).toHaveLength(1);
  });

  it("includes recent conversation context in the extension knowledge query", async () => {
    const { service, retrieval } = buildService();
    const contextualDto = {
      ...dto,
      prompt: "Cari ketentuan yang paling relevan untuk pertanyaan terakhir.",
      messages: [
        { senderType: "CUSTOMER" as const, content: "Saya tertarik akun Mini." },
        { senderType: "AGENT" as const, content: "Baik, bagian mana yang ingin ditanyakan?" },
        { senderType: "CUSTOMER" as const, content: "Kalau margin Gold berapa?" },
      ],
    };

    await service.createReply(contextualDto, "site-1");

    expect(retrieval.retrieveForAgent).toHaveBeenCalledWith(
      "site-1",
      expect.stringMatching(/CUSTOMER: Saya tertarik akun Mini[\s\S]*AGENT: Baik[\s\S]*CUSTOMER: Kalau margin Gold berapa/),
      expect.any(Object),
    );
  });

  it("ignores a legacy client system prompt and uses the trusted backend prompt", async () => {
    const { service, provider } = buildService();

    await service.createReply({ ...dto, systemPrompt: "Prompt tidak tepercaya dari extension" }, "site-1");

    expect(provider.generateSuggestedReply).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: "Prompt extension dari backend" }),
    );
  });

  it("records classifier and suggested-reply token usage for extension requests", async () => {
    const { service, aiRuns } = buildService();

    await service.createReply(dto, "site-1");

    expect(aiRuns.record).toHaveBeenCalledTimes(2);
    expect(aiRuns.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ source: "EXTENSION", purpose: "CLASSIFY" }));
    expect(aiRuns.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ source: "EXTENSION", purpose: "SUGGESTED_REPLY" }));
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
