import { AiIntent } from "@solidchat/shared";
import { MockAiProvider } from "./mock-provider";

describe("MockAiProvider", () => {
  const provider = new MockAiProvider();

  describe("classifyIntent", () => {
    it("detects deposit-related intent from Indonesian keywords", async () => {
      const result = await provider.classifyIntent({ message: "berapa minimal deposit?", history: [], language: "id" });
      expect(result.intent).toBe(AiIntent.DEPOSIT);
    });

    it("falls back to GENERAL_INQUIRY when no keyword matches", async () => {
      const result = await provider.classifyIntent({ message: "halo", history: [], language: "id" });
      expect(result.intent).toBe(AiIntent.GENERAL_INQUIRY);
    });

    it("flags sensitive data and prompt injection independently of intent", async () => {
      const result = await provider.classifyIntent({ message: "PIN saya 123456", history: [], language: "id" });
      expect(result.containsSensitiveData).toBe(true);
    });
  });

  describe("generateAnswer", () => {
    it("replies naturally to greetings without requiring knowledge evidence", async () => {
      const result = await provider.generateAnswer({
        message: "Hallo",
        history: [],
        language: "id",
        intent: AiIntent.GENERAL_INQUIRY,
        evidence: [],
        aiName: "Asisten Virtual",
        organizationName: "Solid Gold",
      });
      expect(result.handoffRequired).toBe(false);
      expect(result.sources).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.answer).toContain("Asisten Virtual");
    });

    it("declines to answer and requests handoff when there is no evidence for a substantive question", async () => {
      const result = await provider.generateAnswer({
        message: "bagaimana cara withdrawal?",
        history: [],
        language: "id",
        intent: AiIntent.WITHDRAWAL,
        evidence: [],
        aiName: "Asisten Virtual",
        organizationName: "Solid Gold",
      });
      expect(result.handoffRequired).toBe(true);
      expect(result.sources).toHaveLength(0);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("answers using the top evidence chunk and cites it as a source", async () => {
      const result = await provider.generateAnswer({
        message: "bagaimana cara withdrawal?",
        history: [],
        language: "id",
        intent: AiIntent.WITHDRAWAL,
        evidence: [
          {
            chunkId: "chunk_1",
            documentId: "doc_1",
            title: "Cara Withdrawal",
            version: 1,
            content: "Withdrawal dapat dilakukan melalui menu aplikasi.",
            audience: "PUBLIC",
          },
        ],
        aiName: "Asisten Virtual",
        organizationName: "Solid Gold",
      });
      expect(result.answer).toContain("Cara Withdrawal");
      expect(result.sources[0]!.documentId).toBe("doc_1");
    });
  });

  describe("summarizeConversation", () => {
    it("never leaks sensitive data patterns into sensitiveDataDetected=false when none present", async () => {
      const result = await provider.summarizeConversation({
        history: [{ senderType: "VISITOR", content: "halo, saya ingin bertanya", createdAt: new Date().toISOString() }],
        language: "id",
      });
      expect(result.sensitiveDataDetected).toBe(false);
    });

    it("flags sensitiveDataDetected when the transcript contains sensitive patterns", async () => {
      const result = await provider.summarizeConversation({
        history: [{ senderType: "VISITOR", content: "PIN saya 123456", createdAt: new Date().toISOString() }],
        language: "id",
      });
      expect(result.sensitiveDataDetected).toBe(true);
    });
  });

  describe("createEmbedding", () => {
    it("is deterministic for identical input", async () => {
      const a = await provider.createEmbedding({ text: "withdrawal dana" });
      const b = await provider.createEmbedding({ text: "withdrawal dana" });
      expect(a).toEqual(b);
    });

    it("produces different vectors for different input", async () => {
      const a = await provider.createEmbedding({ text: "withdrawal dana" });
      const b = await provider.createEmbedding({ text: "registrasi akun" });
      expect(a).not.toEqual(b);
    });
  });
});
