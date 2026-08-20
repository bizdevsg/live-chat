import { createHash } from "node:crypto";
import {
  AiIntent,
  DEFAULT_CONFIDENCE_THRESHOLD,
  PROMPT_INJECTION_PATTERNS,
  SENSITIVE_DATA_PATTERNS,
  type AiProvider,
  type AnswerInput,
  type ClassificationInput,
  type ClassificationResult,
  type EmbeddingInput,
  type AnswerResult,
  type ConversationSummaryResult,
  type SummaryInput,
  type SuggestedReplyInput,
  type SuggestedReplyResult,
} from "@solidchat/shared";
import { buildSmallTalkReply } from "./small-talk";

const INTENT_KEYWORDS: Array<{ intent: AiIntent; keywords: RegExp }> = [
  { intent: AiIntent.ACCOUNT_REGISTRATION, keywords: /(daftar|registrasi|buat akun|sign ?up)/i },
  { intent: AiIntent.DEPOSIT, keywords: /(deposit|setor|top ?up)/i },
  { intent: AiIntent.WITHDRAWAL, keywords: /(withdraw|tarik dana|penarikan)/i },
  { intent: AiIntent.FEES, keywords: /(biaya|komisi|fee)/i },
  { intent: AiIntent.TRADING_PLATFORM, keywords: /(platform|mt4|mt5|trading)/i },
  { intent: AiIntent.MOBILE_APP, keywords: /(aplikasi|mobile|app)/i },
  { intent: AiIntent.SECURITY, keywords: /(keamanan|security|2fa)/i },
  { intent: AiIntent.COMPLAINT, keywords: /(komplain|keluhan|kecewa|penipuan)/i },
  { intent: AiIntent.BRANCH_INFO, keywords: /(cabang|kantor|alamat)/i },
  { intent: AiIntent.HUMAN_REQUEST, keywords: /(cs manusia|agen manusia|bicara dengan (cs|agent|manusia))/i },
];

function detectIntent(message: string): AiIntent {
  const match = INTENT_KEYWORDS.find((entry) => entry.keywords.test(message));
  return match?.intent ?? AiIntent.GENERAL_INQUIRY;
}

function detectSentiment(message: string): ClassificationResult["sentiment"] {
  if (/(marah|kecewa|penipu|parah|buruk sekali)/i.test(message)) return "ANGRY";
  if (/(kecewa|lambat|lama|tidak puas)/i.test(message)) return "NEGATIVE";
  if (/(terima kasih|bagus|puas|mantap)/i.test(message)) return "POSITIVE";
  return "NEUTRAL";
}

/** Deterministic pseudo-embedding (no network call) so cosine re-ranking is exercisable in dev/tests without an API key. */
function pseudoEmbedding(text: string, dimensions = 64): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const vector = new Array(dimensions).fill(0);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const hash = createHash("sha256").update(token).digest();
    for (let i = 0; i < dimensions; i++) {
      vector[i] += ((hash[i % hash.length] ?? 128) - 128) / 128;
    }
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async classifyIntent(input: ClassificationInput): Promise<ClassificationResult> {
    const containsSensitiveData = SENSITIVE_DATA_PATTERNS.some((p) => p.test(input.message));
    const promptInjectionDetected = PROMPT_INJECTION_PATTERNS.some((p) => p.test(input.message));
    return {
      intent: detectIntent(input.message),
      confidence: 0.75,
      sentiment: detectSentiment(input.message),
      containsSensitiveData,
      promptInjectionDetected,
    };
  }

  async generateAnswer(input: AnswerInput): Promise<AnswerResult> {
    const smallTalk = input.evidence.length === 0 ? buildSmallTalkReply(input) : null;
    if (smallTalk) {
      return {
        answer: smallTalk.answer,
        confidence: smallTalk.confidence,
        intent: input.intent,
        sources: [],
        handoffRequired: false,
      };
    }

    if (input.evidence.length === 0) {
      return {
        answer:
          "Mohon maaf, saat ini saya belum memiliki informasi resmi yang cukup untuk menjawab pertanyaan tersebut. Saya akan menghubungkan Anda dengan petugas kami.",
        confidence: 0.2,
        intent: input.intent,
        sources: [],
        handoffRequired: true,
        handoffReason: "KNOWLEDGE_INSUFFICIENT",
      };
    }

    const top = input.evidence[0]!;
    const answer = `Berdasarkan panduan resmi "${top.title}": ${top.content.slice(0, 400)}${
      top.content.length > 400 ? "…" : ""
    }\n\nJika Anda memerlukan bantuan lebih lanjut, saya dapat menghubungkan Anda dengan petugas kami.`;

    return {
      answer,
      confidence: 0.82,
      intent: input.intent,
      sources: input.evidence.slice(0, 3).map((e) => ({
        documentId: e.documentId,
        chunkId: e.chunkId,
        title: e.title,
        version: e.version,
        score: 0.8,
      })),
      handoffRequired: 0.82 < DEFAULT_CONFIDENCE_THRESHOLD,
    };
  }

  async summarizeConversation(input: SummaryInput): Promise<ConversationSummaryResult> {
    const lastVisitorTurn = [...input.history].reverse().find((t) => t.senderType === "VISITOR" || t.senderType === "CUSTOMER");
    return {
      customerGoal: lastVisitorTurn?.content.slice(0, 200) ?? "Belum ada pertanyaan spesifik dari customer.",
      importantFacts: [],
      actionsTaken: input.history.filter((t) => t.senderType === "AI").map((t) => t.content.slice(0, 120)),
      openIssues: ["Menunggu tindak lanjut agent."],
      sensitiveDataDetected: input.history.some((t) => SENSITIVE_DATA_PATTERNS.some((p) => p.test(t.content))),
    };
  }

  async generateSuggestedReply(input: SuggestedReplyInput): Promise<SuggestedReplyResult> {
    const top = input.evidence[0];
    return {
      reply: top
        ? `Terima kasih sudah menunggu. Berdasarkan "${top.title}": ${top.content.slice(0, 300)}`
        : "Terima kasih sudah menunggu, mohon informasi tambahan agar kami dapat membantu lebih lanjut.",
      sources: top ? [{ documentId: top.documentId, chunkId: top.chunkId, title: top.title, version: top.version, score: 0.75 }] : [],
      confidence: top ? 0.7 : 0.3,
    };
  }

  async createEmbedding(input: EmbeddingInput): Promise<number[]> {
    return pseudoEmbedding(input.text);
  }
}
