import { HandoffEvaluatorService } from "./handoff-evaluator.service";
import { AiIntent, HandoffReason } from "@solidchat/shared";
import type { ClassificationResult } from "@solidchat/shared";

function classification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    intent: AiIntent.GENERAL_INQUIRY,
    confidence: 0.8,
    sentiment: "NEUTRAL",
    containsSensitiveData: false,
    promptInjectionDetected: false,
    ...overrides,
  };
}

describe("HandoffEvaluatorService", () => {
  const evaluator = new HandoffEvaluatorService();

  it("returns null when no hard trigger matches (§18 general inquiry stays with AI)", () => {
    expect(evaluator.evaluate("Apa jam operasional kantor?", classification())).toBeNull();
  });

  it("forces handoff when sensitive data was detected upstream", () => {
    const result = evaluator.evaluate("PIN saya 123456", classification({ containsSensitiveData: true }));
    expect(result).toBe(HandoffReason.SENSITIVE_DATA_DETECTED);
  });

  it("forces handoff on prompt injection regardless of message content", () => {
    const result = evaluator.evaluate("halo", classification({ promptInjectionDetected: true }));
    expect(result).toBe(HandoffReason.PROMPT_INJECTION_DETECTED);
  });

  it("leaves human-request intent to the answer model's full-context decision", () => {
    const result = evaluator.evaluate("kapan AI perlu mengarahkan pengguna ke agent?", classification({ intent: AiIntent.HUMAN_REQUEST }));
    expect(result).toBeNull();
  });

  it("detects a deposit issue when intent and keyword both match", () => {
    const result = evaluator.evaluate("deposit saya belum masuk", classification({ intent: AiIntent.DEPOSIT }));
    expect(result).toBe(HandoffReason.DEPOSIT_ISSUE);
  });

  it("does not flag a routine deposit question as an issue", () => {
    const result = evaluator.evaluate("berapa minimal deposit?", classification({ intent: AiIntent.DEPOSIT }));
    expect(result).toBeNull();
  });

  it("blocks requests for guaranteed profit (§17)", () => {
    const result = evaluator.evaluate("apakah ada jaminan profit kalau saya deposit?", classification());
    expect(result).toBe(HandoffReason.PROFIT_GUARANTEE_REQUEST);
  });

  it("blocks specific buy/sell order requests (§17 no personal trading advice)", () => {
    const result = evaluator.evaluate("saya mau beli emas sekarang, order buy ya", classification());
    expect(result).toBe(HandoffReason.BUY_SELL_REQUEST);
  });

  it("escalates an angry customer", () => {
    const result = evaluator.evaluate("saya sangat kecewa dengan pelayanan ini", classification({ sentiment: "ANGRY" }));
    expect(result).toBe(HandoffReason.ANGRY_CUSTOMER);
  });

  describe("withdrawal issue regression (bare \"lama\"/\"pending\" false positive)", () => {
    it("does not flag a plain duration question as a withdrawal issue", () => {
      const result = evaluator.evaluate("withdraw berapa lama?", classification({ intent: AiIntent.WITHDRAWAL }));
      expect(result).toBeNull();
    });

    it("does not flag a routine withdrawal status question", () => {
      const result = evaluator.evaluate("withdraw pending ya prosesnya?", classification({ intent: AiIntent.WITHDRAWAL }));
      expect(result).toBeNull();
    });

    it("still detects an explicit withdrawal complaint (belum masuk)", () => {
      const result = evaluator.evaluate("withdraw saya belum masuk-masuk", classification({ intent: AiIntent.WITHDRAWAL }));
      expect(result).toBe(HandoffReason.WITHDRAWAL_ISSUE);
    });

    it("still detects a complaint phrased as \"kok lama\"", () => {
      const result = evaluator.evaluate("withdraw saya kok lama ya?", classification({ intent: AiIntent.WITHDRAWAL }));
      expect(result).toBe(HandoffReason.WITHDRAWAL_ISSUE);
    });

    it("still detects a complaint phrased as \"sudah ... lama\"", () => {
      const result = evaluator.evaluate("withdraw saya sudah 3 hari lama banget belum cair", classification({ intent: AiIntent.WITHDRAWAL }));
      expect(result).toBe(HandoffReason.WITHDRAWAL_ISSUE);
    });

    it("still detects a withdrawal marked as gagal", () => {
      const result = evaluator.evaluate("withdraw saya gagal terus", classification({ intent: AiIntent.WITHDRAWAL }));
      expect(result).toBe(HandoffReason.WITHDRAWAL_ISSUE);
    });
  });
});
