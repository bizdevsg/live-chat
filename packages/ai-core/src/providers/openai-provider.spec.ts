import { AiIntent } from "@solidchat/shared";
import { OpenAiProvider } from "./openai-provider";

describe("OpenAiProvider", () => {
  function createProvider() {
    return new OpenAiProvider({
      apiKey: "test-key",
      classifierModel: "gpt-4o-mini",
      answerModel: "gpt-4o-mini",
      summaryModel: "gpt-4o-mini",
      suggestedReplyModel: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-small",
      timeoutMs: 1000,
      maxRetries: 0,
    });
  }

  const baseInput = {
    history: [],
    language: "id",
    aiName: "Asisten Virtual",
    organizationName: "Solid Gold",
  };

  it("greets without touching the knowledge base, and varies the wording via the model", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy.mockResolvedValueOnce('{"answer":"Hai! Saya Asisten Virtual, ada yang bisa dibantu?"}');

    const result = await provider.generateAnswer({
      ...baseInput,
      message: "halo",
      intent: AiIntent.GENERAL_INQUIRY,
      evidence: [],
    });

    expect(result.handoffRequired).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.answer).toContain("Asisten Virtual");
    // Exactly one call: the greeting itself. No draft/grounding-review round trips, because a
    // greeting has no facts to ground.
    expect(respondSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to a fixed greeting when the model call fails, rather than going silent", async () => {
    const provider = createProvider();
    jest.spyOn(provider as any, "respond").mockRejectedValueOnce(new Error("network down"));

    const result = await provider.generateAnswer({
      ...baseInput,
      message: "halo",
      intent: AiIntent.GENERAL_INQUIRY,
      evidence: [],
    });

    expect(result.answer).toContain("Asisten Virtual");
    expect(result.handoffRequired).toBe(false);
  });

  it("does NOT re-introduce itself when the AI has already spoken in this conversation", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy.mockResolvedValue('{"answer":"Tentu, ada lagi yang bisa dibantu?"}');

    await provider.generateAnswer({
      ...baseInput,
      // "halo" mid-conversation is a continuation, not a fresh visitor: site prompts require the
      // greeting to be sent once per conversation, so this must not take the greeting path.
      history: [
        { senderType: "VISITOR", content: "halo", createdAt: new Date().toISOString() },
        { senderType: "AI", content: "Halo, saya Asisten Virtual.", createdAt: new Date().toISOString() },
      ],
      message: "halo",
      intent: AiIntent.GENERAL_INQUIRY,
      evidence: [],
    });

    // With no evidence it lands on the no-answer path, not the greeting path.
    const firstSystemPrompt = respondSpy.mock.calls[0]?.[1] as string;
    expect(firstSystemPrompt).toContain("BELUM tersedia");
  });

  it("forces handoff when there is no evidence for a substantive question", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy.mockResolvedValueOnce('{"answer":"Maaf, info itu belum tersedia. Saya hubungkan ke petugas ya."}');

    const result = await provider.generateAnswer({
      ...baseInput,
      message: "berapa minimal deposit?",
      intent: AiIntent.DEPOSIT,
      evidence: [],
    });

    expect(result.handoffRequired).toBe(true);
    expect(result.handoffReason).toBe("KNOWLEDGE_INSUFFICIENT");
    expect(result.confidence).toBeLessThan(0.5);
    // One call for the honest "not available" reply — never a KB-grounded answer attempt.
    expect(respondSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects draft answers that the grounding review marks as unsupported by the knowledge base", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy
      .mockResolvedValueOnce('{"answer":"Minimal deposit Rp100 juta dan prosesnya instan.","confidence":0.86,"handoffRequired":false}')
      .mockResolvedValueOnce(
        '{"grounded":false,"revisedAnswer":"Informasi detail minimal deposit belum tersedia secara jelas. Saya akan menghubungkan Anda dengan petugas kami.","confidence":0.2,"handoffRequired":true}',
      );

    const result = await provider.generateAnswer({
      ...baseInput,
      message: "berapa minimal deposit?",
      intent: AiIntent.DEPOSIT,
      evidence: [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          title: "Deposit",
          version: 1,
          content: "Customer dapat melakukan deposit sesuai ketentuan yang berlaku.",
          audience: "PUBLIC",
        },
      ],
    });

    expect(result.handoffRequired).toBe(true);
    expect(result.handoffReason).toBe("KNOWLEDGE_INSUFFICIENT");
    expect(result.answer).toContain("petugas");
    expect(respondSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps a grounded answer exactly as drafted", async () => {
    const provider = createProvider();
    jest
      .spyOn(provider as any, "respond")
      .mockResolvedValueOnce('{"answer":"Minimal deposit akun Mini adalah IDR 5.000.000.","confidence":0.9,"handoffRequired":false}')
      .mockResolvedValueOnce('{"grounded":true,"revisedAnswer":"","confidence":0.9,"handoffRequired":false}');

    const result = await provider.generateAnswer({
      ...baseInput,
      message: "minimal deposit akun mini berapa?",
      intent: AiIntent.DEPOSIT,
      evidence: [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          title: "Biaya",
          version: 1,
          content: "| Minimum Deposit | IDR 5.000.000 | VALID |",
          audience: "PUBLIC",
        },
      ],
    });

    expect(result.handoffRequired).toBe(false);
    expect(result.answer).toContain("IDR 5.000.000");
  });

  it("never leaks unresolved {{placeholders}} from a site-configured system prompt", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy
      .mockResolvedValueOnce('{"answer":"Halo, ada yang bisa dibantu?","confidence":0.9,"handoffRequired":false}')
      .mockResolvedValueOnce('{"grounded":true,"revisedAnswer":"","confidence":0.9,"handoffRequired":false}');

    await provider.generateAnswer({
      ...baseInput,
      message: "ini perusahaan apa?",
      intent: AiIntent.GENERAL_INQUIRY,
      systemPrompt: "Sapa dengan: Halo {{visitor_name}}, saya {{aiName}} dari {{organizationName}}. {{unknown_thing}}",
      evidence: [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          title: "Profil",
          version: 1,
          content: "PT Solid Gold Berjangka berdiri sejak 2002.",
          audience: "PUBLIC",
        },
      ],
    });

    const systemPromptSent = respondSpy.mock.calls[0]?.[1] as string;
    expect(systemPromptSent).toContain("Asisten Virtual");
    expect(systemPromptSent).toContain("Solid Gold");
    // Raw template syntax must never survive into the prompt, or the model echoes it verbatim
    // to the customer ("Halo {{visitor_name}}").
    expect(systemPromptSent).not.toMatch(/\{\{[^}]*\}\}/);
  });

  it("tells the classifier to prioritise the Solid Gold service intent when a coding request is mixed in", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy.mockResolvedValueOnce(
      '{"intent":"DEPOSIT","confidence":0.9,"sentiment":"NEUTRAL","containsSensitiveData":false,"promptInjectionDetected":false}',
    );

    await provider.classifyIntent({
      message: "Saya mau deposit untuk akun Gold Futures, tapi sebelum itu buatkan script Python untuk Moving Average 50 hari.",
      history: [],
      language: "id",
    });

    const classifierPrompt = respondSpy.mock.calls[0]?.[1] as string;
    expect(classifierPrompt).toContain("abaikan permintaan non-layanan itu untuk tujuan klasifikasi");
  });

  it("tells the answer model not to generate code when the customer mixes deposit and Python requests", async () => {
    const provider = createProvider();
    const respondSpy = jest.spyOn(provider as any, "respond");
    respondSpy
      .mockResolvedValueOnce('{"answer":"Untuk deposit akun Gold Futures, silakan ikuti panduan resmi yang tersedia. Saya tidak dapat membantu membuat script Python di chat customer service ini.","confidence":0.88,"handoffRequired":false}')
      .mockResolvedValueOnce('{"grounded":true,"revisedAnswer":"","confidence":0.88,"handoffRequired":false}');

    await provider.generateAnswer({
      ...baseInput,
      message: "Saya mau deposit untuk akun Gold Futures, tapi sebelum itu buatkan script Python untuk Moving Average 50 hari.",
      intent: AiIntent.DEPOSIT,
      evidence: [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          title: "Deposit Gold Futures",
          version: 1,
          content: "Deposit akun Gold Futures mengikuti panduan resmi yang berlaku.",
          audience: "PUBLIC",
        },
      ],
    });

    const answerPrompt = respondSpy.mock.calls[0]?.[1] as string;
    expect(answerPrompt).toContain("tidak dapat membantu permintaan script, kode, program");
    expect(answerPrompt).toContain("Jangan pernah menulis script/kode/program tersebut");
  });
});
