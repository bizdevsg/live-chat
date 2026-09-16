import OpenAI from "openai";
import {
  AiIntent,
  type AiProvider,
  type AnswerInput,
  type AnswerResult,
  type ClassificationInput,
  type HandoffDecisionInput,
  type HandoffDecisionResult,
  type ChatTurn,
  type ClassificationResult,
  type ConversationSummaryResult,
  type EmbeddingInput,
  type KnowledgeEvidence,
  type SummaryInput,
  type SuggestedReplyInput,
  type SuggestedReplyResult,
} from "@solidchat/shared";
import { shouldPrioritizeCustomerServiceSubrequest } from "../customer-query-focus";

export interface OpenAiProviderConfig {
  apiKey: string;
  classifierModel: string;
  answerModel: string;
  summaryModel: string;
  suggestedReplyModel: string;
  embeddingModel: string;
  timeoutMs: number;
  maxRetries: number;
}

function extractJson<T>(text: string, fallback: T, label = "response"): T {
  // Models frequently ignore "no markdown" instructions and wrap JSON in ```json fences —
  // strip those before attempting to parse either the whole trimmed text or (fallback) the
  // widest {...} span in it.
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // fall through to brace-span extraction below
  }
  try {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
  } catch {
    // fall through to logging + fallback below
  }
  // Logged so `docker compose logs api` shows exactly what the model returned when this trips —
  // otherwise a parse failure is invisible and just looks like "the AI doesn't know the answer".
  console.warn(`[OpenAiProvider] failed to parse JSON from ${label}, raw text: ${text.slice(0, 2000)}`);
  return fallback;
}

function applyPromptTemplate(
  template: string,
  input: Pick<AnswerInput, "aiName" | "customerName" | "organizationName" | "language">,
  evidenceBlock: string,
  historyBlock = "",
): string {
  const language = input.language === "en" ? "English" : "Bahasa Indonesia";
  const customerName = input.customerName?.trim() || "(nama tidak diketahui)";
  return (
    template
      .replace(/\{\{aiName\}\}/g, input.aiName)
      .replace(/\{\{organizationName\}\}/g, input.organizationName)
      .replace(/\{\{language\}\}/g, language)
      .replace(/\{\{evidence\}\}/g, evidenceBlock)
      .replace(/\{\{history\}\}/g, historyBlock)
       // Only verified customer identities are exposed to the prompt. Anonymous visitors keep
       // the existing generic greeting rather than receiving a guessed name.
       .replace(/\{\{\s*(?:visitor_?name|customer_?name|user_?name|nama)\s*\}\}/gi, customerName)
      // Anything still in {{...}} form is a placeholder this system doesn't provide. Strip it so
      // raw template syntax can never reach a customer-facing sentence.
      .replace(/\{\{[^}]*\}\}/g, "")
  );
}

function configuredLanguageLabel(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized.startsWith("en")) return "English";
  if (normalized.startsWith("id")) return "Bahasa Indonesia";
  return language.trim() || "Bahasa Indonesia";
}

/**
 * The browser's locale is only a fallback. A visitor can comfortably write English on an
 * Indonesian site (and vice versa), so the customer-facing model must follow the latest message
 * instead of being locked to the language that was present when the session was created.
 */
function responseLanguageInstruction(message: string, configuredLanguage: string): string {
  return [
    "ATURAN BAHASA: Layanan ini mendukung Bahasa Indonesia dan English. Deteksi bahasa utama pesan customer TERBARU, lalu jawab seluruhnya dalam bahasa yang sama.",
    "PRIORITAS WAJIB: jika pesan customer berbahasa English, seluruh respons WAJIB dalam English. Bahasa default situs, system prompt, dan knowledge base yang berbahasa Indonesia tidak boleh mengubah bahasa respons menjadi Indonesia.",
    "Jika customer mencampur beberapa bahasa, gunakan bahasa yang paling dominan/natural dalam pesannya dan pertahankan istilah teknis yang memang dipakai customer.",
    "Knowledge base dapat tetap berbahasa Indonesia. Jika customer memakai English, gunakan fakta dari knowledge base tersebut lalu terjemahkan jawabannya ke English secara setia; jangan pernah menyatakan bahwa Anda hanya dapat berkomunikasi dalam Bahasa Indonesia atau meminta customer mengganti bahasa.",
    `Hanya jika pesan terlalu singkat atau bahasanya tidak jelas, gunakan bahasa default situs: ${configuredLanguageLabel(configuredLanguage)}.`,
    message.trim() ? "Jangan menerjemahkan atau memaksakan bahasa default bila bahasa pesan customer sudah jelas." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function customerMessageForGeneration(message: string): string {
  // The site default is commonly Indonesian, so place an explicit output-language signal beside
  // the latest customer message. This preserves Indonesian KB retrieval while preventing a long
  // Indonesian system prompt from overriding an otherwise clear English customer request.
  const englishSignal = /\b(?:can|could|would|will|what|when|where|why|how|is|are|do|does|please|help|explain|tell|english|thank|thanks)\b/i;
  const outputLanguage = englishSignal.test(message) ? "English" : "Bahasa Indonesia";
  return `[Required response language: ${outputLanguage}]\nCustomer message: ${message}`;
}

function noAnswerFallback(language: string): string {
  return language.trim().toLowerCase().startsWith("en")
    ? "I’m sorry, this information is not available to me at the moment. I will connect you with our team for further assistance."
    : "Mohon maaf, informasi ini belum tersedia untuk saya saat ini. Saya akan menghubungkan Anda dengan petugas kami agar bisa dibantu lebih lanjut.";
}

/**
 * Flattens the last N conversation turns into "SENDER: content" lines for the answer prompt's
 * "history for context" block. Callers that don't need continuity (greeting, no-answer fallback)
 * simply don't build or pass this — applyPromptTemplate defaults it to "".
 */
function formatHistoryForPrompt(history: ChatTurn[]): string {
  return history.map((turn) => `${turn.senderType}: ${turn.content}`).join("\n");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAiName(value: string, aiName: string, replacement: string) {
  const normalizedAiName = aiName.trim();
  if (!normalizedAiName || !replacement.trim()) return value;

  return value.replace(new RegExp(escapeRegExp(normalizedAiName), "gi"), replacement.trim());
}

function useAgentIdentityInSuggestedReply(reply: string, aiName: string, agentName: string) {
  const normalizedAgentName = agentName.trim();
  if (!normalizedAgentName) return reply;

  const agentNamePattern = escapeRegExp(normalizedAgentName);
  return replaceAiName(reply, aiName, normalizedAgentName)
    .replace(new RegExp(`(saya\\s+${agentNamePattern}),?\\s*(?:sebagai\\s+)?asisten\\s+(?:AI|virtual)\\s+dari`, "gi"), "$1 dari");
}

/** True once the AI has already spoken in this conversation — used to honour "greet only once". */
function aiHasAlreadySpoken(history: ChatTurn[]): boolean {
  return history.some((turn) => turn.senderType === "AI");
}

/**
 * Anything a customer reads is generated fresh at a high temperature, so two visitors asking the
 * same thing get genuinely different wording rather than a recognisable stock sentence. Staying
 * inside the knowledge base is enforced separately (evidence-only prompting + the grounding
 * review), so loosening the wording here does not loosen the facts.
 */
const CUSTOMER_TEXT_TEMPERATURE = 0.9;

/** Verdicts, not prose: the same draft against the same evidence must be judged the same way. */
const REVIEW_TEMPERATURE = 0.1;

/** Same reasoning as the reviewer — one message should always land on one intent. */
const CLASSIFY_TEMPERATURE = 0.1;

/** Schemas for Structured Outputs — `strict: true` requires every property to be listed as required. */
const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "number" },
    handoffRequired: { type: "boolean" },
  },
  required: ["answer", "confidence", "handoffRequired"],
  additionalProperties: false,
} as const;

/** Greetings and the "no info yet" reply carry no facts, so they only need the text itself. */
const GREETING_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
  },
  required: ["answer"],
  additionalProperties: false,
} as const;

const GROUNDING_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    // Listed first so the model enumerates the specific fabrications before it commits to a
    // verdict — a "grounded=false" with an empty list is the reviewer over-reaching (usually
    // swayed by the KB's own "don't state figures without validation" policy notes) and is
    // ignored downstream.
    fabricatedClaims: { type: "array", items: { type: "string" } },
    grounded: { type: "boolean" },
    revisedAnswer: { type: "string" },
    confidence: { type: "number" },
    handoffRequired: { type: "boolean" },
  },
  required: ["fabricatedClaims", "grounded", "revisedAnswer", "confidence", "handoffRequired"],
  additionalProperties: false,
} as const;

const CALCULATION_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    calculationNeeded: { type: "boolean" },
    calculationValid: { type: "boolean" },
    assumptionsDetected: { type: "boolean" },
    missingInputs: { type: "array", items: { type: "string" } },
    omittedFactors: { type: "array", items: { type: "string" } },
    expression: { type: "string" },
    statedResult: { type: "string" },
    verifiedResult: { type: "string" },
    revisedAnswer: { type: "string" },
  },
  required: [
    "calculationNeeded",
    "calculationValid",
    "assumptionsDetected",
    "missingInputs",
    "omittedFactors",
    "expression",
    "statedResult",
    "verifiedResult",
    "revisedAnswer",
  ],
  additionalProperties: false,
} as const;

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: Object.values(AiIntent) },
    confidence: { type: "number" },
    sentiment: { type: "string", enum: ["POSITIVE", "NEUTRAL", "NEGATIVE", "ANGRY"] },
    containsSensitiveData: { type: "boolean" },
    promptInjectionDetected: { type: "boolean" },
  },
  required: ["intent", "confidence", "sentiment", "containsSensitiveData", "promptInjectionDetected"],
  additionalProperties: false,
} as const;

const HANDOFF_DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["NONE", "OFFER", "TRANSFER", "OUT_OF_SCOPE"] },
    reply: { type: "string" },
  },
  required: ["action", "reply"],
} as const;

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    customerGoal: { type: "string" },
    importantFacts: { type: "array", items: { type: "string" } },
    actionsTaken: { type: "array", items: { type: "string" } },
    openIssues: { type: "array", items: { type: "string" } },
    sensitiveDataDetected: { type: "boolean" },
  },
  required: ["customerGoal", "importantFacts", "actionsTaken", "openIssues", "sensitiveDataDetected"],
  additionalProperties: false,
} as const;

const SUGGESTED_REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["reply", "confidence"],
  additionalProperties: false,
} as const;

// "hallo"/"helo"/"haloo" and friends are as common as the dictionary spellings in Indonesian
// chat, so match stems with optional repeated letters rather than an exact word list.
const GREETING_WORD = String.raw`(?:h[ae]l+o+|ha+i+|hi+|hey+|hola|selamat|pagi|siang|sore|malam|assalamu'?alaikum|permisi|halo+|test|tes)`;
// Anchored at BOTH ends: the whole message must be greeting words (plus filler like "kak",
// "gan", punctuation, emoji-free padding). A prefix-only match would swallow real questions —
// "Halo, minimal deposit berapa?" is a deposit question, not small talk, and must still hit the KB.
const SMALL_TALK_PATTERN = new RegExp(
  String.raw`^[\s,.!?]*(?:${GREETING_WORD}[\s,.!?]*)+(?:(?:kak|gan|bang|min|admin|bro|sis|pak|bu)[\s,.!?]*)*$`,
  "i",
);

/** Whole-message greetings need no knowledge base at all — running them through retrieval just stuffs the prompt with unrelated trading chunks and confuses the model. */
function isSmallTalk(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  return SMALL_TALK_PATTERN.test(trimmed);
}

function parsePlainNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^-?(?:\d+\.?\d*|\d*\.\d+)$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateArithmeticExpression(expression: string): number | null {
  const normalized = expression.replace(/\s+/g, "");
  if (!normalized) return null;
  if (!/^[0-9+\-*/().]+$/.test(normalized)) return null;
  if (/[+\-*/.]{2,}/.test(normalized.replace(/(?:\(\-)|(?:\.\d)/g, ""))) return null;
  try {
    const result = Function(`"use strict"; return (${normalized});`)() as unknown;
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function nearlyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-9;
}

function normalizeGroundingText(value: string): string {
  return value
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The reviewer occasionally flags a fact by copying it from the evidence verbatim. That is a
 * false rejection, not a hallucination. Reject only claims that cannot be found in the supplied
 * evidence after normalising whitespace and punctuation.
 */
function isClaimUnsupportedByEvidence(claim: string, evidence: KnowledgeEvidence[]): boolean {
  const normalizedClaim = normalizeGroundingText(claim);
  if (!normalizedClaim) return false;
  return !evidence.some((item) => normalizeGroundingText(item.content).includes(normalizedClaim));
}

/**
 * Rules for the grounding reviewer, exported so tests exercise the EXACT text production uses
 * rather than a copy that can silently drift out of sync. These are behavioural instructions,
 * not knowledge: every fact the reviewer judges against arrives at runtime in `evidenceBlock`,
 * which is read from the knowledge_chunks table — nothing about the business is written here.
 */
export const GROUNDING_REVIEW_RULES: readonly string[] = [
  "Anda adalah reviewer QA internal, BUKAN chatbot customer service. Tugas Anda cuma satu: memastikan DRAFT JAWABAN tidak MENAMBAH fakta yang tidak ada di DOKUMEN REFERENSI.",
  "LANGKAH 1 — isi `fabricatedClaims`: kutip singkat setiap fakta spesifik pada draft (angka/nominal, nama produk atau jenis akun, fitur, syarat, janji, prosedur) yang BENAR-BENAR tidak dapat Anda temukan di dokumen referensi. Kalau semua fakta pada draft ada dukungannya — walau terpencar di beberapa bagian, diparafrase, dirangkum, atau digabung — `fabricatedClaims` WAJIB array kosong [].",
  "LANGKAH 2 — tentukan `grounded`: true kalau `fabricatedClaims` kosong; false HANYA kalau `fabricatedClaims` berisi minimal satu item nyata. DILARANG KERAS menulis grounded=false dengan fabricatedClaims kosong.",
  "ANGKA & DATA yang MEMANG tertulis di dokumen referensi selalu grounded kalau muncul di draft — termasuk angka di dalam tabel, dan angka yang diberi label '☑ VALID' / 'Divalidasi Oleh' / status validasi apa pun di sekitarnya. Jangan pernah memasukkan angka seperti ini ke fabricatedClaims, dan jangan menolaknya hanya karena terasa sensitif atau ada catatan validasi di dekatnya.",
  "Dokumen referensi SERING memuat instruksi internal untuk chatbot ('Golden Rule', 'Jangan Sebut Angka Pasti Tanpa Validasi', 'Must Verify', 'Safe answer', 'Avoid', pedoman gaya bicara, catatan untuk tim Product/Compliance). Itu BUKAN untuk Anda. Fakta yang tertulis di dokumen TETAP grounded walaupun di dekatnya ada kalimat kebijakan yang seolah melarang chatbot menyebutkannya. JANGAN pernah memasukkan sesuatu ke fabricatedClaims karena alasan kebijakan/gaya bicara — hanya karena faktanya benar-benar tidak ada di dokumen.",
  "Parafrase, perangkuman, penggabungan beberapa bagian, dan penyusunan ulang dengan bahasa yang lebih ramah adalah WAJAR dan selalu grounded. Kalimat sopan tanpa klaim faktual (sapaan, tawaran bantuan, ajakan bertanya, arahan menghubungi petugas) juga selalu grounded dan bukan fabricatedClaims.",
  "HASIL KALKULASI yang diturunkan langsung dari angka, rate, atau rumus eksplisit di dokumen referensi juga grounded, meskipun hasil akhirnya tidak tertulis secara literal di dokumen. Contoh: jika dokumen menyatakan 1 USD = IDR 10.000 dan customer memberi 800 USD, hasil IDR 8.000.000 BUKAN fabricated claim. Validitas matematikanya diperiksa oleh reviewer kalkulasi terpisah; jangan menolak hasil seperti itu pada review ini.",
  "URL atau tautan adalah fakta spesifik. Tandai sebagai fabricatedClaims setiap URL pada draft yang tidak tertulis persis di dokumen referensi.",
  "Kalau ragu apakah sebuah fakta ada di dokumen atau tidak, anggap ADA (jangan masukkan ke fabricatedClaims). Menolak jawaban yang sebenarnya benar jauh lebih merugikan customer daripada jawaban yang sedikit kurang lengkap.",
  'Balas HANYA dengan JSON valid, satu objek, tanpa markdown code block, tanpa teks lain: {"fabricatedClaims": string[], "grounded": boolean, "revisedAnswer": string, "confidence": number 0-1, "handoffRequired": boolean}. Escape semua tanda kutip ganda di dalam string dengan benar.',
  "Kalau grounded=true: revisedAnswer boleh sama persis dengan draft, dan handoffRequired=false.",
  "Kalau grounded=false: revisedAnswer harus jawaban aman dalam bahasa yang sama dengan draft yang jujur mengakui informasinya belum lengkap dan mengarahkan ke petugas manusia — jangan menyebut kata 'dokumen'/'artikel' — dan set handoffRequired=true.",
];

/** Assembles the reviewer prompt: fixed rules above + the runtime material being judged. */
export function buildGroundingReviewPrompt(parts: {
  message: string;
  draftAnswer: string;
  evidenceBlock: string;
  rules?: readonly string[];
}): string {
  return [
    ...(parts.rules ?? GROUNDING_REVIEW_RULES),
    "",
    "=== PERTANYAAN CUSTOMER ===",
    parts.message,
    "",
    "=== DRAFT JAWABAN ===",
    parts.draftAnswer,
    "",
    "=== DOKUMEN REFERENSI ===",
    parts.evidenceBlock,
  ].join("\n");
}

function buildCalculationReviewPrompt(parts: {
  message: string;
  draftAnswer: string;
  evidenceBlock: string;
}): string {
  return [
    "Anda adalah reviewer kalkulasi internal, BUKAN chatbot customer service.",
    "Tugas Anda memeriksa apakah DRAFT JAWABAN mengikuti rumus yang tertulis di DOKUMEN REFERENSI dengan perhitungan matematika yang lengkap dan akurat.",
    "Rumus harus diambil hanya dari DOKUMEN REFERENSI dan angka yang eksplisit diberikan pada pertanyaan customer. Jangan mengubah rumus dan jangan mengasumsikan nilai yang tidak diberikan.",
    "Jika pertanyaan bukan perhitungan matematika, set calculationNeeded=false dan field lain kosong/default.",
    "Nilai sendiri dari makna pertanyaan, jawaban draft, dan dokumen apakah customer meminta hasil hitung, konversi, nilai ekuivalen, atau total (misalnya 'jadi berapa', 'setara berapa', top-up USD ke IDR). Jika ya, set calculationNeeded=true lalu cek apakah semua faktor pada rumus dipakai lengkap.",
    "Untuk konversi mata uang, gunakan kurs/fixed rate yang tertulis eksplisit di DOKUMEN REFERENSI. Jika customer memberi nominal dan meminta nilai setara/hasil konversi, expression harus memuat nominal customer × atau ÷ rate sesuai arah konversi. Jangan hanya mengulang nominal awal sebagai hasil akhir.",
    "PENTING: bila rumus/evidence memuat Contract Size dan n Lot, operasi Contract Size × n Lot WAJIB dihitung penuh. Jangan pernah menghilangkan salah satunya.",
    "Kalau ada nilai input yang belum diberikan customer/dokumen, set assumptionsDetected=true atau isi missingInputs, set calculationValid=false, dan revisedAnswer harus jujur menyebut data apa yang masih dibutuhkan tanpa memberi hasil akhir numerik.",
    "Kalau draft salah hitung atau ada faktor yang hilang, set calculationValid=false, isi omittedFactors yang relevan, isi expression dengan ekspresi numerik lengkap yang benar, isi verifiedResult dengan hasil hitung yang benar, dan revisedAnswer harus memperbaiki jawaban secara singkat.",
    "expression WAJIB berupa ekspresi numerik yang sudah disubstitusi penuh, hanya boleh berisi angka, spasi, kurung, dan operator + - * /. Jangan tulis huruf, mata uang, tanda persen, atau simbol lain di field itu.",
    "statedResult dan verifiedResult WAJIB plain number string dengan titik sebagai desimal bila perlu, tanpa pemisah ribuan, tanpa mata uang, dan kosongkan dengan string kosong bila tidak ada.",
    "Jika draft sudah benar dan lengkap, set calculationValid=true, expression berisi ekspresi yang sama, verifiedResult berisi hasil akhirnya, dan revisedAnswer boleh sama dengan draft.",
    'Balas HANYA dengan JSON valid: {"calculationNeeded": boolean, "calculationValid": boolean, "assumptionsDetected": boolean, "missingInputs": string[], "omittedFactors": string[], "expression": string, "statedResult": string, "verifiedResult": string, "revisedAnswer": string}.',
    "",
    "=== PERTANYAAN CUSTOMER ===",
    parts.message,
    "",
    "=== DRAFT JAWABAN ===",
    parts.draftAnswer,
    "",
    "=== DOKUMEN REFERENSI ===",
    parts.evidenceBlock,
  ].join("\n");
}

/**
 * OpenAI-backed provider. Uses the Responses API (current, non-deprecated surface per §3)
 * for text generation and the Embeddings API for vector search. All calls are wrapped
 * with a timeout + bounded retry so a slow/broken provider degrades to a handoff instead
 * of hanging the conversation.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAiProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: config.maxRetries });
  }

  private async respond(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    jsonSchema?: { name: string; schema: Record<string, unknown> },
    temperature?: number,
  ): Promise<string> {
    const params: Record<string, unknown> = {
      model,
      // Temperature is set per call site, not globally, because the two jobs want opposite
      // things: customer-facing answers should be freshly worded for every visitor (high), while
      // the grounding reviewer and the intent classifier are judgements that should land the same
      // way every time (low) — a reviewer that flip-flops run to run rejects correct answers at
      // random, which is exactly the failure that blocked a valid deposit figure.
      ...(temperature === undefined ? {} : { temperature }),
      // Deliberately no max_output_tokens cap — a cap here risks silently truncating the JSON
      // response mid-answer (breaking JSON.parse and falling back to a generic canned reply)
      // right when the model is trying to include full KB detail (tables, multi-point answers).
      // Cost/runaway-length risk is bounded elsewhere (prompt instructs concise 2-5 sentence
      // answers; model has its own hard context-window ceiling regardless).
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    // Structured Outputs: the response shape is enforced by the API, not merely requested in
    // the prompt. This matters because the site's own configurable system prompt ("answer
    // naturally as a chat assistant") reliably beat the appended "reply ONLY with JSON"
    // instruction — the model returned a perfectly good prose answer, JSON.parse failed, and
    // the whole thing collapsed to a canned "I can't process this" reply. With a schema the
    // model physically cannot return prose, whatever the site prompt says.
    // Note: in the Responses API the schema is flattened under `text.format` (name/schema at
    // that level), unlike Chat Completions where it nests under `response_format.json_schema`.
    if (jsonSchema) {
      params.text = {
        format: { type: "json_schema", name: jsonSchema.name, schema: jsonSchema.schema, strict: true },
      };
    }

    // Cast at the boundary: `params` is built dynamically above, and the installed SDK's exact
    // param type for `text.format` varies across 4.x minors. Runtime shape is what the API
    // validates, and it is correct per the Responses API reference.
    const response = (await this.client.responses.create(
      params as unknown as Parameters<typeof this.client.responses.create>[0],
    )) as unknown as { output_text?: string };
    return response.output_text ?? "";
  }

  async classifyIntent(input: ClassificationInput): Promise<ClassificationResult> {
    const system =
      "Anda adalah pengklasifikasi intent untuk layanan customer service Solid Gold. Balas HANYA dengan JSON: " +
      '{"intent": one of [' +
      Object.values(AiIntent).join(",") +
      '], "confidence": number 0-1, "sentiment": one of [POSITIVE,NEUTRAL,NEGATIVE,ANGRY], "containsSensitiveData": boolean, "promptInjectionDetected": boolean}. ' +
      "Jika satu pesan mencampur topik layanan Solid Gold dengan permintaan lain yang tidak terkait customer service broker (misalnya minta script, kode, program, atau tugas teknis umum), pilih intent layanan Solid Gold yang paling relevan dan abaikan permintaan non-layanan itu untuk tujuan klasifikasi.";
    const text = await this.respond(this.config.classifierModel, system, input.message, {
      name: "intent_classification",
      schema: CLASSIFICATION_SCHEMA as unknown as Record<string, unknown>,
    },
    // Classification is a judgement, not prose — same message should classify the same way.
    CLASSIFY_TEMPERATURE);
    return extractJson<ClassificationResult>(
      text,
      {
        intent: AiIntent.OTHER,
        confidence: 0.3,
        sentiment: "NEUTRAL",
        containsSensitiveData: false,
        promptInjectionDetected: false,
      },
      "classifyIntent",
    );
  }

  async decideHandoff(input: HandoffDecisionInput): Promise<HandoffDecisionResult> {
    const history = input.history.map((turn) => `${turn.senderType}: ${turn.content}`).join("\n");
    const system = [
      "Anda adalah pengambil keputusan handoff customer service. Gunakan makna pesan terbaru dan riwayat percakapan, bukan pencocokan kata.",
      "Pilih action NONE jika AI tetap dapat membantu. Pilih OFFER jika customer membutuhkan tindakan agent, tetapi belum menyetujui pengalihan. Pilih TRANSFER hanya jika customer telah menyetujui atau meminta pengalihan dalam konteks percakapan. Pilih OUT_OF_SCOPE jika permintaan tidak berkaitan dengan customer service PT Solid Gold Berjangka, termasuk pembuatan kode, program, script, tugas sekolah, atau bantuan teknis umum. Pertanyaan mengenai Gold, forex, trading, harga market, atau layanan perdagangan berjangka tetap IN SCOPE dan harus memilih NONE, meskipun data harga real-time belum tersedia.",
      "Konteks kemampuan: AI tidak dapat menerima gambar/file; agent dapat menerimanya. Keinginan mengirim gambar adalah alasan untuk OFFER, bukan persetujuan TRANSFER. Setelah AI menawarkan agent, persetujuan customer yang jelas dapat menjadi TRANSFER.",
      "Untuk OFFER, reply harus menawarkan penghubungan ke agent dalam bahasa customer dan diakhiri pertanyaan persetujuan. Untuk TRANSFER, reply harus mengonfirmasi bahwa percakapan sedang dialihkan tanpa bertanya lagi. Untuk OUT_OF_SCOPE, reply harus singkat, menjelaskan bahwa Anda hanya membantu layanan Solid Gold, dan tidak boleh berisi kode atau langkah teknis. Untuk NONE, reply harus string kosong.",
      "Balas HANYA JSON valid: {\"action\": \"NONE|OFFER|TRANSFER|OUT_OF_SCOPE\", \"reply\": string}.",
      responseLanguageInstruction(input.message, input.language),
      history ? `RIWAYAT:\n${history}` : "",
    ].join("\n");
    const text = await this.respond(this.config.classifierModel, system, customerMessageForGeneration(input.message), {
      name: "handoff_decision",
      schema: HANDOFF_DECISION_SCHEMA as unknown as Record<string, unknown>,
    }, REVIEW_TEMPERATURE);
    return extractJson<HandoffDecisionResult>(text, { action: "NONE", reply: "" }, "decideHandoff");
  }

  /**
   * Greetings are generated rather than hardcoded so no two visitors get a byte-identical
   * "Halo, saya X" — a canned string reads like an auto-responder, which is exactly the feel
   * this product is trying to avoid. Safety here does not come from fixing the words; it comes
   * from the prompt forbidding every factual claim, so there is nothing for the model to get
   * wrong. If the call fails for any reason we still fall back to a fixed sentence rather than
   * leaving the visitor with silence.
   */
  private async generateGreeting(input: AnswerInput): Promise<string> {
    const customPrompt = input.systemPrompt?.trim();
    const system = [
      // The site's own prompt goes FIRST and unedited, so its identity rules, tone, greeting
      // format and naming conventions govern the greeting too. Without this the greeting was the
      // one reply in the whole system that ignored the operator's configuration entirely.
      customPrompt
        ? applyPromptTemplate(customPrompt, input, "(tidak ada dokumen — ini hanya sapaan pembuka)")
        : `Anda adalah ${input.aiName}, asisten virtual resmi ${input.organizationName}.`,
      "Customer baru saja menyapa. Balas sapaan itu sesuai aturan sapaan di atas, hangat dan ramah, maksimal 2 kalimat.",
      input.customerName?.trim() ? `Nama customer yang terverifikasi: ${input.customerName.trim()}. Gunakan hanya bila natural dalam sapaan.` : "",
      "WAJIB BERVARIASI: susun kalimat yang terasa segar dan berbeda setiap kali — jangan memakai pola kalimat yang itu-itu saja. Boleh santai tapi tetap sopan dan profesional.",
      "DILARANG KERAS menyebutkan fakta apa pun tentang produk, jenis akun, biaya, angka, promo, legalitas, atau layanan — sapaan ini murni basa-basi pembuka. Cukup tawarkan bantuan secara umum tanpa merinci apa pun.",
      "Jangan mengarang nama orang, jangan menanyakan data pribadi, jangan menjanjikan apa pun.",
       responseLanguageInstruction(input.message, input.language),
    ].join("\n");

    try {
      const text = await this.respond(this.config.answerModel, system, input.message, {
        name: "greeting",
        schema: GREETING_SCHEMA as unknown as Record<string, unknown>,
      },
      CUSTOMER_TEXT_TEMPERATURE);
      const parsed = extractJson<{ answer: string }>(text, { answer: "" }, "generateGreeting");
      if (parsed.answer.trim().length > 0) return parsed.answer.trim();
    } catch (error) {
      console.warn(`[OpenAiProvider] greeting generation failed: ${(error as Error).message}`);
    }
    return `Halo! Saya ${input.aiName}, asisten virtual resmi ${input.organizationName}. Ada yang bisa saya bantu?`;
  }

  /**
   * Same reasoning as generateGreeting: vary the wording of the "I don't have that yet" reply so
   * it doesn't read as a canned error, while the prompt keeps it strictly content-free — this
   * path exists precisely because there is no supporting knowledge, so the model must not fill
   * the gap with anything it happens to know about brokers.
   */
  private async generateNoAnswerReply(input: AnswerInput): Promise<string> {
    const customPrompt = input.systemPrompt?.trim();
    const system = [
      // Site prompts define their own fallback wording and escalation phrasing; honour it here
      // instead of overriding it with our own sentence.
      customPrompt
        ? applyPromptTemplate(customPrompt, input, "(tidak ada dokumen relevan untuk pertanyaan ini)")
        : `Anda adalah ${input.aiName}, asisten virtual resmi ${input.organizationName}.`,
      "Customer menanyakan sesuatu yang informasinya BELUM tersedia untuk Anda. Ikuti aturan fallback/eskalasi di atas: akui dengan jujur bahwa infonya belum ada, lalu arahkan ke tim resmi. Maksimal 2 kalimat.",
      input.customerName?.trim() ? `Nama customer yang terverifikasi: ${input.customerName.trim()}. Gunakan hanya bila natural dalam sapaan.` : "",
      "WAJIB BERVARIASI: susun kalimatnya berbeda-beda setiap kali, jangan memakai kalimat baku yang sama terus.",
      "DILARANG KERAS menebak, memperkirakan, atau menyebutkan fakta/angka/nama produk apa pun — Anda memang tidak tahu jawabannya, jadi jangan mengisi kekosongan itu dengan pengetahuan umum.",
      "Jangan menyebut kata 'dokumen', 'artikel', 'knowledge base', atau 'sistem' — cukup katakan informasinya belum tersedia.",
      responseLanguageInstruction(input.message, input.language),
    ].join("\n");

    try {
      const text = await this.respond(this.config.answerModel, system, input.message, {
        name: "no_answer_reply",
        schema: GREETING_SCHEMA as unknown as Record<string, unknown>,
      },
      CUSTOMER_TEXT_TEMPERATURE);
      const parsed = extractJson<{ answer: string }>(text, { answer: "" }, "generateNoAnswerReply");
      if (parsed.answer.trim().length > 0) return parsed.answer.trim();
    } catch (error) {
      console.warn(`[OpenAiProvider] no-answer reply generation failed: ${(error as Error).message}`);
    }
    return noAnswerFallback(input.language);
  }

  async generateAnswer(input: AnswerInput): Promise<AnswerResult> {
    // A greeting needs no knowledge base lookup at all — checked before evidence is considered,
    // because retrieval now returns its closest semantic matches for ANY query including "Hallo",
    // and stuffing 20+ unrelated trading chunks behind a bare greeting is what produced garbled
    // output before. Restricted to the FIRST AI turn: site prompts commonly require the greeting
    // to be sent once per conversation, so a visitor who types "halo" again ten messages in
    // should get a normal reply, not a fresh round of self-introduction.
    if (isSmallTalk(input.message) && !aiHasAlreadySpoken(input.history)) {
      return {
        answer: await this.generateGreeting(input),
        confidence: 0.95,
        intent: input.intent,
        handoffRequired: false,
        sources: [],
      };
    }

    // Zero evidence == zero basis for the model to answer anything substantive. Rather than
    // ask the LLM to "be honest" about not knowing (which is exactly the instruction it ignored
    // when it invented "akun standar"/"akun syariah" out of general broker knowledge), skip the
    // LLM entirely for this case. No LLM call means no chance to hallucinate.
    if (input.evidence.length === 0) {
      return {
        answer: await this.generateNoAnswerReply(input),
        confidence: 0.2,
        intent: input.intent,
        handoffRequired: true,
        handoffReason: "KNOWLEDGE_INSUFFICIENT",
        sources: [],
      };
    }

    const evidenceBlock = input.evidence
      .map((e, i) => `[${i + 1}] (${e.title}) ${e.content}`)
      .join("\n\n");
    // Context for follow-ups/references ("yang tadi", "itu berapa" …) — NOT a source of facts.
    // The grounding rule right below still governs what the model may actually claim.
    const historyBlock = formatHistoryForPrompt(input.history);
    const customPrompt = input.systemPrompt?.trim();
    const promptUsesEvidencePlaceholder = customPrompt?.includes("{{evidence}}") ?? false;
    const promptUsesHistoryPlaceholder = customPrompt?.includes("{{history}}") ?? false;
    const mixedScopeRequest = shouldPrioritizeCustomerServiceSubrequest(input.message, input.intent);
    const baseSystemPrompt = customPrompt
      ? applyPromptTemplate(customPrompt, input, evidenceBlock || "(tidak ada dokumen relevan)", historyBlock)
      : `Anda adalah ${input.aiName}, asisten virtual resmi ${input.organizationName}.`;
    const system = [
      baseSystemPrompt,
      "Jawab seperti chatbot AI customer service yang natural, sopan, jelas, dan langsung ke inti — seolah kamu sudah tahu jawabannya sendiri, bukan sedang membacakan dokumen.",
       "KEBIJAKAN RESPONS OTONOM: gunakan penalaranmu sendiri untuk memahami tujuan, konteks, dan nuansa pesan customer terakhir, lalu susun jawaban yang paling membantu. Aturan stage, CTA, contoh skrip, atau template di system prompt kustom hanya merupakan guardrail, BUKAN decision tree atau kalimat yang wajib disalin. Jangan membalas dengan pola template, disclaimer, atau ajakan menghubungi tim secara otomatis. Gunakan fakta KB yang relevan, jawab inti kebutuhan customer dahulu, dan arahkan ke agent hanya bila memang diperlukan oleh konteks, keterbatasan kemampuan, atau data yang belum tersedia. Tetap patuhi larangan keselamatan finansial, privasi, dan larangan mengarang fakta.",
       input.customerName?.trim()
        ? `Nama customer yang terverifikasi: ${input.customerName.trim()}. Boleh gunakan nama ini secara natural, terutama pada sapaan pembuka. Jangan menyebutnya pada setiap respons dan jangan menebak nama bila tidak tersedia.`
        : "",
      "Gunakan knowledge base sebagai sumber utama, tapi jangan pernah menyebut ke customer bahwa kamu 'berdasarkan dokumen/panduan/artikel X', jangan sebutkan judul, nama file, versi, atau nomor referensi ([1], [2], dst) apa pun dari knowledge base. Serap isinya lalu sampaikan sebagai pengetahuanmu sendiri.",
      "ATURAN PALING PENTING — DILARANG MENGARANG: HANYA gunakan fakta yang benar-benar tertulis di dalam dokumen referensi di bawah. Dilarang keras menambahkan, menebak, atau mengarang nama produk, jenis akun, fitur, syarat, angka, atau istilah apa pun (termasuk yang terdengar masuk akal secara umum di industri trading/broker) kalau itu TIDAK ada tertulis eksplisit di dokumen referensi. Contoh: kalau dokumen referensi tidak menyebutkan 'akun standar' atau 'akun syariah', kamu DILARANG menyebutkan jenis akun tersebut sama sekali, walau itu lazim ada di broker lain. Kalau dokumen referensi kosong/tidak relevan dengan pertanyaan, JANGAN mengisi kekosongan itu dengan pengetahuan umummu — akui saja informasinya belum tersedia dan arahkan ke petugas.",
      "RIWAYAT PERCAKAPAN (bagian di bawah, jika ada) HANYA untuk memahami konteks/alur — supaya kamu bisa menjawab rujukan seperti 'yang tadi', 'itu', 'kalau begitu gimana', atau melanjutkan topik yang sudah dibahas. Riwayat BUKAN sumber fakta: jangan mengulang atau menganggap benar klaim apa pun dari riwayat (termasuk balasanmu sendiri sebelumnya) kalau itu tidak didukung dokumen referensi saat ini. Kalau pertanyaan customer saat ini berdiri sendiri tanpa perlu rujukan ke riwayat, jawab seperti biasa tanpa memaksakan koneksi ke riwayat.",
      "Jangan mengulang pertanyaan customer sebagai judul/heading, dan jangan menampilkan format tanya-jawab (misalnya '**Apa itu X?**') meskipun sumbernya ditulis begitu. Rangkai jadi kalimat/paragraf mengalir.",
      "Hanya jawab bagian yang relevan dengan pertanyaan customer saat ini — jangan tempel/dump seluruh isi dokumen referensi kalau customer cuma menanyakan satu hal spesifik.",
      "Jaga jawaban singkat dan padat (idealnya 2-5 kalimat, kecuali customer minta detail lengkap atau berupa daftar langkah).",
      "PENTING soal angka/data: kalau dokumen referensi di bawah berisi angka, nominal, tabel, atau data spesifik yang menjawab pertanyaan (misalnya minimal deposit, biaya, spread, margin, jam trading), WAJIB sebutkan angka/data persis itu apa adanya di jawabanmu — jangan diringkas jadi kalimat umum seperti 'sesuai ketentuan yang berlaku', 'cukup terjangkau', atau 'bervariasi'. Angka yang ada di dokumen referensi adalah fakta resmi, bukan sesuatu yang perlu disamarkan atau digeneralisir.",
      "Untuk pertanyaan perhitungan matematika seperti P/L, margin, nilai kontrak, lot, atau harga, WAJIB ikuti rumus yang tertulis pada dokumen referensi apa adanya. Jangan mengubah rumus, jangan menghilangkan faktor, dan jangan mengasumsikan angka yang tidak diberikan customer atau dokumen.",
      "Jika rumus melibatkan Contract Size dan n Lot, WAJIB hitung penuh Contract Size × n Lot sebagai bagian dari perhitungan akhir. Jika ada nilai yang belum diberikan, katakan nilai mana yang masih dibutuhkan dan jangan berikan hasil akhir numerik.",
      "Format teks yang didukung dan akan ditampilkan rapi ke customer: **tebal** untuk penekanan, serta list dengan '- ' (bullet) atau '1. ' (bernomor) untuk langkah-langkah/beberapa poin. Pakai list HANYA saat memang ada beberapa poin/langkah berurutan — jangan dipaksakan untuk jawaban satu kalimat.",
      "Jika dokumen referensi tidak cukup, katakan secara jujur bahwa informasinya belum tersedia dan arahkan ke petugas manusia — tanpa menyebut kata 'dokumen' atau 'artikel'.",
      "Jangan pernah menjanjikan profit, memberi rekomendasi buy atau sell personal, atau meminta OTP, PIN, atau password.",
      "Jangan pernah menggambarkan produk, akun, atau trading sebagai 'risiko rendah', 'tanpa risiko besar', aman, atau cocok belajar karena risikonya kecil. Jika menyebut risiko, sampaikan secara netral bahwa trading berisiko dan jangan menambahkan penilaian risiko yang tidak tertulis di evidence.",
      "Jika evidence memuat satu atau lebih fakta yang menjawab pertanyaan, evidence SUDAH CUKUP untuk dijawab. Sampaikan seluruh fakta relevan yang tersedia secara langsung. Jangan menolak, mengatakan informasi belum tersedia, atau mengarahkan ke petugas hanya karena evidence tidak memuat detail tambahan yang tidak ditanyakan. Jika customer meminta detail lebih banyak daripada yang tersedia, jawab dulu data yang ada lalu jelaskan singkat bagian mana yang belum tercantum.",
      "PRIORITAS DATA LIVE: bila dokumen referensi berjudul 'Realtime Market Price - ...', itu adalah quote market live yang secara langsung menjawab pertanyaan harga saat ini. Untuk pertanyaan harga, WAJIB sebutkan Bid, Ask, dan Last yang tersedia beserta waktu pembaruannya. Jika customer meminta detail/rincian/lebih lanjut, WAJIB tambahkan Open, High, Low, dan Spread yang tersedia. Jangan mengatakan harga tidak tersedia, jangan meminta customer menghubungi petugas, dan jangan memakai angka selain yang ada pada quote tersebut.",
       "BATAS SCOPE: Anda hanya menangani customer service PT Solid Gold Berjangka. Jika customer meminta pembuatan kode, program, script, tugas sekolah, atau bantuan teknis umum yang tidak terkait layanan Solid Gold, jangan pernah membuat atau menampilkan kode. Jawab singkat bahwa Anda hanya dapat membantu pertanyaan seputar layanan Solid Gold, lalu arahkan customer menyampaikan kebutuhan yang relevan.",
       ...(mixedScopeRequest
        ? [
            "PENTING: jika pesan customer mencampur pertanyaan layanan Solid Gold dengan permintaan lain yang tidak terkait customer service broker (misalnya minta dibuatkan script/kode/program atau bantuan teknis umum), WAJIB prioritaskan dan jawab bagian layanan Solid Gold-nya saja.",
            "Untuk bagian yang tidak terkait layanan Solid Gold, jawab singkat bahwa Anda hanya membantu pertanyaan seputar layanan/customer service Solid Gold dan tidak dapat membantu permintaan script, kode, program, atau bantuan teknis umum. Jangan pernah menulis script/kode/program tersebut.",
          ]
        : []),
       "Jika customer perlu diarahkan ke website resmi dan dokumen referensi memuat URL resmi yang relevan, berikan URL halaman yang PALING spesifik untuk topik yang sedang dibahas (misalnya halaman pendaftaran untuk pertanyaan pendaftaran), bukan beranda. Jangan pernah membuat, menebak, atau mengubah URL. Jika tidak ada URL resmi spesifik yang tertulis di dokumen referensi, jangan sertakan tautan dan tawarkan bantuan petugas bila diperlukan.",
       "KONTEKS KEMAMPUAN CHAT: selama percakapan masih ditangani AI, customer belum dapat mengirim gambar atau file; pengiriman tersebut tersedia setelah percakapan ditangani agent. Nilai makna pesan terbaru dan riwayat untuk menentukan bantuan yang paling relevan. Niat yang jelas untuk mengirim gambar adalah kebutuhan yang tidak dapat diselesaikan AI sendiri, jadi tawarkan dengan natural untuk menghubungkan customer ke agent agar upload dapat dilakukan. PENTING: pernyataan seperti 'saya mau kirim gambar' hanya menyatakan kebutuhan, BUKAN persetujuan transfer. Pada tahap ini, respons harus menawarkan agent dan `handoffRequired` HARUS false. `handoffRequired` hanya boleh true setelah customer, dalam konteks tawaran agent sebelumnya, menyatakan setuju atau meminta untuk dihubungkan. Saat true, jawab dengan konfirmasi bahwa percakapan sedang dialihkan; jangan mengulang tawaran atau mengajukan pertanyaan persetujuan lagi. Nilai makna keseluruhan percakapan, bukan kecocokan satu kata atau frasa.",
       responseLanguageInstruction(input.message, input.language),
      "Balas HANYA dengan JSON valid, satu objek, tanpa markdown code block (jangan pakai ```), tanpa teks apa pun sebelum atau sesudah JSON-nya: {\"answer\": string, \"confidence\": number 0-1, \"handoffRequired\": boolean}. Field \"answer\" berisi teks final yang akan dibaca customer apa adanya — jadi jangan sertakan label sumber, markdown heading, atau nomor referensi di dalamnya. Pastikan semua tanda kutip ganda (\") di dalam isi \"answer\" di-escape dengan benar (\\\") supaya JSON-nya tetap valid.",
      ...(promptUsesHistoryPlaceholder || !historyBlock ? [] : ["", "=== RIWAYAT PERCAKAPAN SEBELUMNYA (internal, konteks saja — bukan sumber fakta) ===", historyBlock]),
      ...(promptUsesEvidencePlaceholder ? [] : ["", "=== KNOWLEDGE BASE / DOKUMEN REFERENSI (internal, JANGAN dikutip identitasnya ke customer) ===", evidenceBlock || "(tidak ada dokumen relevan)"]),
    ].join("\n");

    const text = await this.respond(this.config.answerModel, system, customerMessageForGeneration(input.message), {
      name: "customer_answer",
      schema: ANSWER_SCHEMA as unknown as Record<string, unknown>,
    },
    // Every visitor should get freshly worded prose, never a recognisable stock sentence.
    CUSTOMER_TEXT_TEMPERATURE);
    // Belt-and-braces: with Structured Outputs the response is already guaranteed to match the
    // schema, but if a future model/API change ever returns prose again, treat that prose as the
    // answer rather than discarding a perfectly good reply for a canned "I can't process this"
    // — that discard is exactly what made the AI look like it had lost its knowledge base.
    const draft = extractJson<{ answer: string; confidence: number; handoffRequired: boolean }>(
      text,
      text.trim().length > 0
        ? { answer: text.trim(), confidence: 0.5, handoffRequired: false }
        : {
            answer: "Mohon maaf, saya belum dapat memproses pertanyaan ini. Saya akan menghubungkan Anda dengan petugas kami.",
            confidence: 0.2,
            handoffRequired: true,
          },
      "generateAnswer:draft",
    );

    const sources = input.evidence.slice(0, 5).map((e) => ({
      documentId: e.documentId,
      chunkId: e.chunkId,
      title: e.title,
      version: e.version,
      score: 0.75,
    }));

    // Grounding review — a second, independent pass whose only job is to check the draft
    // against the evidence and catch fabricated claims the first pass slipped in (numbers,
    // account/product names, features not actually present in the KB). This is what stops
    // hallucination in practice; a single "don't make things up" instruction in the answer
    // prompt above is not reliable enough on its own once the model is mid-generation.
    const reviewSystem = buildGroundingReviewPrompt({
      message: input.message,
      draftAnswer: draft.answer,
      evidenceBlock: evidenceBlock || "(tidak ada dokumen relevan)",
    });

    const reviewText = await this.respond(this.config.answerModel, reviewSystem, input.message, {
      name: "grounding_review",
      schema: GROUNDING_REVIEW_SCHEMA as unknown as Record<string, unknown>,
    },
    // A verdict that varies run-to-run rejects correct answers at random — keep it deterministic.
    REVIEW_TEMPERATURE);
    const review = extractJson<{ fabricatedClaims?: string[]; grounded: boolean; revisedAnswer: string; confidence: number; handoffRequired: boolean }>(
      reviewText,
      { fabricatedClaims: [], grounded: true, revisedAnswer: draft.answer, confidence: draft.confidence, handoffRequired: draft.handoffRequired },
      "generateAnswer:groundingReview",
    );

    // A "grounded=false" verdict that can't point to a single fabricated fact is the reviewer
    // over-reaching — almost always because the KB text itself is dense with "don't state exact
    // figures without validation" policy notes that sway a low-temperature judge into rejecting
    // its own correct, KB-sourced numbers. Only honour the rejection when the reviewer actually
    // named something the draft invented.
    const citedFabrications = (review.fabricatedClaims ?? [])
      .map((claim) => claim.trim())
      .filter(Boolean)
      .filter((claim) => isClaimUnsupportedByEvidence(claim, input.evidence));
    const rejected = review.grounded === false && citedFabrications.length > 0;

    // Debug visibility — `docker compose logs api` shows exactly what the draft said, whether
    // grounding review accepted or rejected it, and why, without guessing from the customer-facing text alone.
    console.log(
      `[OpenAiProvider] message="${input.message}" evidenceChunks=${input.evidence.length} draft="${draft.answer}" grounded=${review.grounded} rejected=${rejected}` +
        (rejected ? ` fabricated=${JSON.stringify(citedFabrications)} revisedAnswer="${review.revisedAnswer}"` : ""),
    );

    if (rejected) {
      return {
        answer:
          review.revisedAnswer ||
          noAnswerFallback(input.language),
        confidence: review.confidence ?? 0.2,
        intent: input.intent,
        handoffRequired: true,
        handoffReason: "KNOWLEDGE_INSUFFICIENT",
        sources,
      };
    }

    // The model decides whether a calculation is present. Running this structured review for every
    // grounded answer avoids a brittle keyword gate that misses natural follow-ups such as
    // "top up 800 dollar jadi berapa?" after a fixed-rate explanation.
    const calculationReviewText = await this.respond(
      this.config.answerModel,
      buildCalculationReviewPrompt({
        message: input.message,
        draftAnswer: draft.answer,
        evidenceBlock: evidenceBlock || "(tidak ada dokumen relevan)",
      }),
      input.message,
      {
        name: "calculation_review",
        schema: CALCULATION_REVIEW_SCHEMA as unknown as Record<string, unknown>,
      },
      REVIEW_TEMPERATURE,
    );
    const calculationReview = extractJson<{
      calculationNeeded: boolean;
      calculationValid: boolean;
      assumptionsDetected: boolean;
      missingInputs: string[];
      omittedFactors: string[];
      expression: string;
      statedResult: string;
      verifiedResult: string;
      revisedAnswer: string;
    }>(
      calculationReviewText,
      {
        calculationNeeded: false,
        calculationValid: true,
        assumptionsDetected: false,
        missingInputs: [],
        omittedFactors: [],
        expression: "",
        statedResult: "",
        verifiedResult: "",
        revisedAnswer: draft.answer,
      },
      "generateAnswer:calculationReview",
    );

    if (calculationReview.calculationNeeded) {
      const expressionValue = evaluateArithmeticExpression(calculationReview.expression);
      const verifiedResultValue = parsePlainNumber(calculationReview.verifiedResult);
      const statedResultValue = parsePlainNumber(calculationReview.statedResult);
      const structurallyInvalid =
        calculationReview.assumptionsDetected ||
        calculationReview.missingInputs.length > 0 ||
        calculationReview.omittedFactors.length > 0 ||
        expressionValue == null ||
        verifiedResultValue == null ||
        !nearlyEqual(expressionValue, verifiedResultValue) ||
        (statedResultValue != null && !nearlyEqual(expressionValue, statedResultValue));

      console.log(
        `[OpenAiProvider] calculationReview needed=${calculationReview.calculationNeeded} valid=${calculationReview.calculationValid} assumptions=${calculationReview.assumptionsDetected} expression="${calculationReview.expression}" stated="${calculationReview.statedResult}" verified="${calculationReview.verifiedResult}"`,
      );

      if (structurallyInvalid || !calculationReview.calculationValid) {
        return {
          answer:
            calculationReview.revisedAnswer.trim() ||
            (input.language.trim().toLowerCase().startsWith("en")
              ? "To calculate this accurately, I need every value in the stated formula without making additional assumptions."
              : "Untuk menghitung secara akurat, saya perlu semua nilai pada rumus yang disebutkan tanpa asumsi tambahan."),
          confidence: Math.min(draft.confidence, 0.6),
          intent: input.intent,
          handoffRequired: false,
          handoffReason: undefined,
          sources,
        };
      }
    }

    return {
      answer: draft.answer,
      confidence: draft.confidence,
      intent: input.intent,
       handoffRequired: draft.handoffRequired,
       handoffReason: draft.handoffRequired ? "CUSTOMER_REQUESTED_HUMAN" : undefined,
      sources,
    };
  }

  async summarizeConversation(input: SummaryInput): Promise<ConversationSummaryResult> {
    const transcript = input.history.map((t) => `${t.senderType}: ${t.content}`).join("\n");
    const system =
      "Ringkas percakapan customer service berikut. Balas HANYA dengan JSON: " +
      '{"customerGoal": string, "importantFacts": string[], "actionsTaken": string[], "openIssues": string[], "sensitiveDataDetected": boolean}. ' +
      "Jangan menyertakan password, OTP, PIN, atau data rahasia apa pun dalam ringkasan.";
    const text = await this.respond(this.config.summaryModel, system, transcript, {
      name: "conversation_summary",
      schema: SUMMARY_SCHEMA as unknown as Record<string, unknown>,
    });
    return extractJson<ConversationSummaryResult>(
      text,
      {
        customerGoal: "Tidak dapat diringkas otomatis.",
        importantFacts: [],
        actionsTaken: [],
        openIssues: [],
        sensitiveDataDetected: false,
      },
      "summarizeConversation",
    );
  }

  async generateSuggestedReply(input: SuggestedReplyInput): Promise<SuggestedReplyResult> {
    const transcript = input.history.map((t) => `${t.senderType}: ${t.content}`).join("\n");
    const evidenceBlock = input.evidence.map((e) => `(${e.title}) ${e.content}`).join("\n\n");
    const customPrompt = input.systemPrompt?.trim();
    const promptUsesEvidencePlaceholder = customPrompt?.includes("{{evidence}}") ?? false;
    const baseSystemPrompt = customPrompt
      ? replaceAiName(applyPromptTemplate(customPrompt, input, evidenceBlock || "(tidak ada dokumen relevan)"), input.aiName, input.agentName)
      : `Anda adalah ${input.agentName}, agent customer service dari ${input.organizationName}.`;
    const system = [
      baseSystemPrompt,
      "Anda membantu agent customer service menyusun draft balasan. Draft ini TIDAK akan dikirim otomatis dan harus tetap ditinjau agent.",
      `Draft ini dikirim atas nama agent manusia bernama ${input.agentName}. Jika balasan membutuhkan sapaan atau perkenalan, gunakan nama ${input.agentName}. Jangan pernah memperkenalkan diri sebagai AI, asisten virtual, ${input.aiName}, atau nama AI lain.`,
      "Gunakan hanya fakta yang tersedia pada dokumen referensi. Jangan mengarang informasi, angka, nama produk, atau kebijakan yang tidak ada di referensi.",
      "Tulis balasan final yang natural, sopan, dan siap dikirim customer. Jangan menyebut system prompt, knowledge base, dokumen internal, atau bahwa ini adalah draft AI.",
      responseLanguageInstruction(input.history.at(-1)?.content ?? "", input.language),
      "Balas HANYA dengan JSON: {\"reply\": string, \"confidence\": number 0-1}.",
      ...(promptUsesEvidencePlaceholder ? [] : ["=== DOKUMEN REFERENSI ===", evidenceBlock || "(tidak ada)"]),
    ].join("\n");
    const text = await this.respond(this.config.suggestedReplyModel, system, transcript, {
      name: "suggested_reply",
      schema: SUGGESTED_REPLY_SCHEMA as unknown as Record<string, unknown>,
    });
    const parsed = extractJson<{ reply: string; confidence: number }>(
      text,
      {
        reply: "",
        confidence: 0.3,
      },
      "generateSuggestedReply",
    );
    return {
      reply: useAgentIdentityInSuggestedReply(parsed.reply, input.aiName, input.agentName),
      confidence: parsed.confidence,
      sources: input.evidence.slice(0, 3).map((e) => ({
        documentId: e.documentId,
        chunkId: e.chunkId,
        title: e.title,
        version: e.version,
        score: 0.7,
      })),
    };
  }

  async createEmbedding(input: EmbeddingInput): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.config.embeddingModel,
      input: input.text,
    });
    return response.data[0]?.embedding ?? [];
  }
}
