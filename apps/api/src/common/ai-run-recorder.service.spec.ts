import { AiRunRecorderService } from "./ai-run-recorder.service";

describe("AiRunRecorderService", () => {
  it("records usage without requiring a conversation", async () => {
    const prisma = { aiRun: { create: jest.fn().mockResolvedValue({ id: "run-1" }) } };
    const service = new AiRunRecorderService(prisma as never);

    await service.record({
      organizationId: "org-1",
      siteId: "site-1",
      source: "KNOWLEDGE_TESTER",
      purpose: "ANSWER",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 120,
      outputTokens: 30,
      latencyMs: 500,
    });

    expect(prisma.aiRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        siteId: "site-1",
        conversationId: undefined,
        source: "KNOWLEDGE_TESTER",
        purpose: "ANSWER",
        inputTokens: 120,
        outputTokens: 30,
      }),
    });
  });
});
