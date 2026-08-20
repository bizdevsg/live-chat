/**
 * Fixed OpenAI model/runtime settings. These used to be per-organization columns on
 * ai_configurations (classifierModel, answerModel, summaryModel, suggestedReplyModel,
 * embeddingModel, confidenceThreshold, maxTokens, timeoutMs, maxRetries) — in practice every
 * site used the same values, so that was configuration surface with no real use. Simplified
 * to one hardcoded source of truth; change these constants (and redeploy) if the models ever
 * need to differ.
 */
export const AI_MODELS = {
  classifier: "gpt-4o-mini",
  answer: "gpt-4o-mini",
  summary: "gpt-4o-mini",
  suggestedReply: "gpt-4o-mini",
  embedding: "text-embedding-3-small",
} as const;

/** AI confidence threshold below which a conversation is handed off to a human agent. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;

export const AI_TIMEOUT_MS = 20_000;
export const AI_MAX_RETRIES = 2;

/**
 * Token budget for expanding retrieved evidence to full document context (see
 * KnowledgeRetriever.retrieve's includeFullContext option). After the top-K/diversity-capped
 * chunks are picked, the retriever fills in more chunks from the *same* already-relevant
 * documents (in original document order) up to this budget, so the model sees surrounding
 * context — e.g. a table's header row plus neighboring rows — instead of just isolated,
 * disconnected snippets. Kept well under gpt-4o-mini's context window since this budget is
 * for evidence text alone (system prompt + history + evidence all need to fit together).
 */
export const KNOWLEDGE_FULL_CONTEXT_MAX_TOKENS = 6000;

/** Consecutive low-confidence/failed AI answers before forcing a handoff, per §18. */
export const MAX_AI_FAILURES_BEFORE_HANDOFF = 2;

export const VISITOR_TOKEN_TTL_SECONDS = 60 * 60 * 12;
export const ACCESS_TOKEN_DEFAULT_TTL = "15m";
export const REFRESH_TOKEN_DEFAULT_TTL = "30d";

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export const SENSITIVE_DATA_PATTERNS: RegExp[] = [
  /\b\d{6}\b/, // 6-digit OTP
  /\bOTP\b/i,
  /\bPIN\b/i,
  /\bpassword\b/i,
  /\bkata sandi\b/i,
  /\bkode (rahasia|otp|verifikasi)\b/i,
  /\b(?:\d[ -]*?){13,19}\b/, // card/account-like long digit sequences
];

export const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|the)?\s*(previous|prior|above)\s*instructions?/i,
  /abaikan (semua|instruksi) sebelumnya/i,
  /show (me )?(the )?system prompt/i,
  /tampilkan system prompt/i,
  /you are now (in )?developer mode/i,
  /berpura-pura(lah)? (sebagai|jadi) (developer|admin)/i,
  /reveal (your|the) (instructions|credentials|api key)/i,
  /jalankan (perintah|query) (admin|sql)/i,
  /act as (an? )?(admin|root|system)/i,
];

// Upper bound on how many of a site's ACTIVE knowledge chunks get pulled into memory and
// semantically ranked per question (see KnowledgeRetriever — it now scores the whole eligible
// set rather than pre-filtering with a keyword search, so the customer doesn't have to type the
// KB's exact wording to get an answer). 2000 chunks comfortably covers a KB of this size with
// headroom to grow; a real KB this size overflowing that limit is the signal to move to a
// proper ANN/vector index instead of raising this number further.
export const KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT = 2000;
export const KNOWLEDGE_RETRIEVAL_TOP_K = 8;
