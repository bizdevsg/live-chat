/**
 * Customers sometimes paste credentials (password, PIN, OTP, card number) into the chat. The AI
 * must always open its reply with a friendly reminder not to do that and to change the password
 * through the official channel — without repeating or quoting the value. The site System Prompt
 * asks for this too, but a prompt is only a request to the model, so this guarantees it.
 */
export const SENSITIVE_DATA_NOTICE =
  "Kak, jangan kirim password, PIN, OTP, atau nomor kartu di chat ya, demi keamanan akun kakak sebaiknya segera ganti password lewat kanal resmi.";

/** A credential keyword followed closely by a value containing a digit ("password saya Contoh123", "pin: 123456"). */
const CREDENTIAL_VALUE_PATTERN = /\b(?:password|passwd|pass|pw|kata\s*sandi|pin|otp)\b[^\n\d]{0,25}?\S*\d\S*/i;
/** 13-19 digit run, optionally grouped by spaces or dashes — a card number. */
const CARD_NUMBER_PATTERN = /(?<![\d])(?:\d[ -]?){13,19}(?![\d])/;
/** The reply already opens by telling the customer not to share the data. */
const ALREADY_REMINDED_PATTERN = /jangan\s+(?:kirim|bagikan|share|berikan|sebut)/i;

export function messageContainsCredentials(message: string): boolean {
  return CREDENTIAL_VALUE_PATTERN.test(message) || CARD_NUMBER_PATTERN.test(message);
}

/** Puts the reminder first unless the answer's opening already carries it. */
export function withSensitiveDataNotice(answer: string): string {
  const trimmed = answer.trim();
  if (ALREADY_REMINDED_PATTERN.test(trimmed.slice(0, 200))) return trimmed;
  return trimmed ? `${SENSITIVE_DATA_NOTICE}\n\n${trimmed}` : SENSITIVE_DATA_NOTICE;
}
