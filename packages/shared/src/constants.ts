/** Default AI confidence threshold below which a conversation is handed off to a human agent. Configurable per-organization via ai_configurations. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

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

export const KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT = 80;
export const KNOWLEDGE_RETRIEVAL_TOP_K = 8;
