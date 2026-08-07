import { PROMPT_INJECTION_PATTERNS, SENSITIVE_DATA_PATTERNS } from "@solidchat/shared";

export interface ContentGuardResult {
  containsSensitiveData: boolean;
  promptInjectionDetected: boolean;
  maskedContent: string;
}

/** Detects OTP/PIN/password-like content (§31) and prompt-injection phrasing (§32) before anything reaches the AI provider. */
export function scanContent(content: string): ContentGuardResult {
  const containsSensitiveData = SENSITIVE_DATA_PATTERNS.some((pattern) => pattern.test(content));
  const promptInjectionDetected = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(content));

  let maskedContent = content;
  if (containsSensitiveData) {
    for (const pattern of SENSITIVE_DATA_PATTERNS) {
      maskedContent = maskedContent.replace(new RegExp(pattern.source, `${pattern.flags}g`), "[DIMASKING]");
    }
  }

  return { containsSensitiveData, promptInjectionDetected, maskedContent };
}
