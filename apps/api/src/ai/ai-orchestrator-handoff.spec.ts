import { AiIntent } from "@solidchat/shared";
import type { ClassificationResult } from "@solidchat/shared";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { HandoffEvaluatorService } from "./handoff-evaluator.service";

const EVIDENCE = [{ chunkId: "c1", documentId: "d1", title: "KB", version: 1, content: "isi", audience: "PUBLIC", sourceUrl: null }];

interface Scenario {
  message: string;
  classifierAction: ClassificationResult["handoffAction"];
  evidence: unknown[];
  /** Earlier turns, oldest first, before the visitor's message. */
  before?: Array<{ senderType: string; content: string }>;
  intent?: AiIntent;
}

async function run(s: Scenario) {
  const posted: Array<{ content: string; metadata?: { handoffDecision?: Record<string, unknown> } }> = [];
  const generateAnswer = jest.fn().mockResolvedValue({ answer: "Jawaban dari knowledge.", confidence: 0.9, intent: AiIntent.GENERAL_INQUIRY, handoffRequired: false, sources: [] });
  const provider = {
    name: "mock",
    classifyIntent: jest.fn().mockResolvedValue({
      intent: s.intent ?? AiIntent.GENERAL_INQUIRY,
      confidence: 0.9,
      sentiment: "NEUTRAL",
      containsSensitiveData: false,
      promptInjectionDetected: false,
      retrievalQuery: "query",
      handoffAction: s.classifierAction,
      handoffReply: "Balasan classifier.",
    }),
    generateAnswer,
    consumeTokenUsage: () => ({}),
  };
  const turns = [
    ...(s.before ?? []).map((t, i) => ({ id: `b${i}`, senderType: t.senderType, content: t.content, createdAt: new Date(2026, 0, 1, 0, i) })),
    { id: "last", senderType: "VISITOR", content: s.message, createdAt: new Date(2026, 0, 1, 1, 0) },
  ];
  const prisma = {
    conversation: {
      findUnique: jest.fn().mockResolvedValue({ id: "conv", handlerType: "AI", siteId: "site", organizationId: "org", language: "id", intent: "X", customer: null }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ organizationId: "org", siteId: "site" }),
      update: jest.fn().mockResolvedValue({}),
    },
    site: { findUnique: jest.fn().mockResolvedValue({ aiName: "Solid Prime AI", settings: { aiEnabled: true, showAiSourcesToCustomer: false } }) },
    message: { findMany: jest.fn().mockResolvedValue([...turns].reverse()) },
    aiPrompt: { findFirst: jest.fn().mockResolvedValue(null) },
    aiRun: { update: jest.fn().mockResolvedValue({}) },
  };
  const conversations = {
    postMessage: jest.fn().mockImplementation(async (m) => void posted.push(m)),
    requestAgent: jest.fn().mockResolvedValue({}),
    hasPendingVisitorMessageSince: jest.fn().mockResolvedValue(false),
  };
  const service = new AiOrchestratorService(
    prisma as never,
    conversations as never,
    { retrieveForCustomer: jest.fn().mockResolvedValue(s.evidence) } as never,
    { getProviderForSite: jest.fn().mockResolvedValue({ provider, config: { id: "cfg" }, model: "m" }) } as never,
    new HandoffEvaluatorService(),
    { record: jest.fn() } as never,
    { toConversation: jest.fn() } as never,
    { getRealtimePriceEvidence: () => [], getRealtimePriceAnswer: () => null } as never,
    { record: jest.fn().mockResolvedValue({ id: "run" }) } as never,
  );
  jest.spyOn(service, "summarize").mockResolvedValue(null as never);
  await service.processVisitorTurn("conv");
  return { posted, generateAnswer, conversations, decision: posted[0]?.metadata?.handoffDecision };
}

describe("AiOrchestratorService handoff vs. evidence", () => {
  it("1. 'kenapa saya tidak bisa login?' no longer hits a forced-handoff rule and goes to the answer path", async () => {
    const r = await run({ message: "kenapa saya tidak bisa login?", classifierAction: "NONE", evidence: EVIDENCE });
    expect(r.generateAnswer).toHaveBeenCalled();
    expect(r.conversations.requestAgent).not.toHaveBeenCalled();
    expect(r.posted[0]?.content).toBe("Jawaban dari knowledge.");
  });

  it("2. classifier=TRANSFER + evidence + 'gabisa login' -> NONE, answer path", async () => {
    const r = await run({ message: "gabisa login", classifierAction: "TRANSFER", evidence: EVIDENCE });
    expect(r.decision).toEqual({ classifierAction: "TRANSFER", finalAction: "NONE", overriddenByEvidence: true, evidenceCount: 1 });
    expect(r.generateAnswer).toHaveBeenCalled();
    expect(r.conversations.requestAgent).not.toHaveBeenCalled();
  });

  it("3. classifier=OFFER + evidence + 'stop limit itu apa?' -> NONE, answer path", async () => {
    const r = await run({ message: "stop limit itu apa?", classifierAction: "OFFER", evidence: EVIDENCE });
    expect(r.decision).toMatchObject({ classifierAction: "OFFER", finalAction: "NONE", overriddenByEvidence: true });
    expect(r.generateAnswer).toHaveBeenCalled();
  });

  it("4. classifier=OUT_OF_SCOPE + evidence + 'video call wpb lewat aplikasi apa?' -> NONE, answer path", async () => {
    const r = await run({ message: "video call wpb lewat aplikasi apa?", classifierAction: "OUT_OF_SCOPE", evidence: EVIDENCE });
    expect(r.decision).toMatchObject({ classifierAction: "OUT_OF_SCOPE", finalAction: "NONE", overriddenByEvidence: true });
    expect(r.generateAnswer).toHaveBeenCalled();
  });

  it("5. classifier=OUT_OF_SCOPE + no evidence + 'cuaca hari ini gimana?' -> stays OUT_OF_SCOPE", async () => {
    const r = await run({ message: "cuaca hari ini gimana?", classifierAction: "OUT_OF_SCOPE", evidence: [] });
    expect(r.decision).toEqual({ classifierAction: "OUT_OF_SCOPE", finalAction: "OUT_OF_SCOPE", overriddenByEvidence: false, evidenceCount: 0 });
    expect(r.generateAnswer).not.toHaveBeenCalled();
    expect(r.posted[0]?.content).toBe("Balasan classifier.");
  });

  it("6. classifier=TRANSFER + evidence + 'saya mau bicara dengan CS' -> stays TRANSFER", async () => {
    const r = await run({ message: "saya mau bicara dengan CS", classifierAction: "TRANSFER", evidence: EVIDENCE });
    expect(r.decision).toMatchObject({ finalAction: "TRANSFER", overriddenByEvidence: false });
    expect(r.conversations.requestAgent).toHaveBeenCalled();
    expect(r.generateAnswer).not.toHaveBeenCalled();
  });

  it("7. AI offered a handoff last turn and the visitor says 'iya' -> TRANSFER", async () => {
    const r = await run({
      message: "iya",
      classifierAction: "TRANSFER",
      evidence: EVIDENCE,
      before: [
        { senderType: "VISITOR", content: "ada masalah sama akun saya" },
        { senderType: "AI", content: "Apakah Anda ingin saya menghubungkan Anda dengan petugas kami?" },
      ],
    });
    expect(r.decision).toMatchObject({ finalAction: "TRANSFER", overriddenByEvidence: false });
    expect(r.conversations.requestAgent).toHaveBeenCalled();
  });

  it("7b. a bare 'iya' after an unrelated AI answer is NOT consent to a handoff", async () => {
    const r = await run({
      message: "iya",
      classifierAction: "TRANSFER",
      evidence: EVIDENCE,
      before: [{ senderType: "AI", content: "Minimal deposit adalah USD 500. Sudah jelas?" }],
    });
    expect(r.decision).toMatchObject({ finalAction: "NONE", overriddenByEvidence: true });
  });

  it("8. a message hitting another forced rule still hands off before anything else", async () => {
    const r = await run({ message: "deposit saya belum masuk", classifierAction: "NONE", evidence: EVIDENCE, intent: AiIntent.DEPOSIT });
    expect(r.conversations.requestAgent).toHaveBeenCalled();
    expect(r.generateAnswer).not.toHaveBeenCalled();
  });
});
