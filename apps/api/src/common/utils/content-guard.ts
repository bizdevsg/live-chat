import { PROMPT_INJECTION_PATTERNS, SENSITIVE_DATA_PATTERNS } from "@solidchat/shared";

export interface ContentGuardResult {
  containsSensitiveData: boolean;
  promptInjectionDetected: boolean;
  maskedContent: string;
}

export const CREDENTIAL_MASK = "••••••••";

const KEYWORD = "password|passwd|pass|pw|kata\\s*sandi|pin|otp|kode\\s+(?:rahasia|otp|verifikasi)";
const FILLER = "akun|saya|ku|aku|nya|anda|kamu|baru|lama|login|ini";
const VALUE_CHARS = "[^\\s,;!?]";

/** "password saya adalah X", "pin: X", "otp = X" — an explicit separator, so any token counts as the value. */
const EXPLICIT_VALUE = new RegExp(`\\b(${KEYWORD})\\b((?:\\s+(?:${FILLER}))*\\s*(?:adalah|is|yaitu|:|=)\\s*)${VALUE_CHARS}{3,}`, "gi");
/** "password saya QaTest12345", "pin 123 456" — no separator, so the value must contain a digit. */
const BARE_VALUE = new RegExp(`\\b(${KEYWORD})\\b((?:\\s+(?:${FILLER}))*\\s+)${VALUE_CHARS}*\\d${VALUE_CHARS}*(?:[ -]\\d+)*`, "gi");

/** Replaces the value after a credential keyword with a mask, keeping the keyword and the rest of the sentence. */
export function maskCredentialValues(content: string): string {
  return content.replace(EXPLICIT_VALUE, `$1$2${CREDENTIAL_MASK}`).replace(BARE_VALUE, `$1$2${CREDENTIAL_MASK}`);
}

/** Detects OTP/PIN/password-like content (§31) and prompt-injection phrasing (§32) before anything reaches the AI provider. */
export function scanContent(content: string): ContentGuardResult {
  const promptInjectionDetected = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(content));

  let maskedContent = maskCredentialValues(content);
  let containsSensitiveData = maskedContent !== content;
  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    maskedContent = maskedContent.replace(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`), (match) => {
      if (match.endsWith(CREDENTIAL_MASK)) return match; // already masked above
      containsSensitiveData = true;
      return CREDENTIAL_MASK;
    });
  }

  return { containsSensitiveData, promptInjectionDetected, maskedContent };
}
