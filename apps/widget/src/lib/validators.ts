export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Rejects obvious keyboard-mashing like "4444444144" or "0123456789". */
function looksLikeKeyboardMash(digits: string): boolean {
  const digitCounts = new Map<string, number>();
  for (const digit of digits) digitCounts.set(digit, (digitCounts.get(digit) ?? 0) + 1);
  const mostRepeatedDigitCount = Math.max(...digitCounts.values());
  if (mostRepeatedDigitCount / digits.length >= 0.7) return true; // e.g. "4444444144"

  return [...digits].every((digit, index) => {
    if (index === 0) return true;
    const diff = Number(digit) - Number(digits[index - 1]);
    return diff === 1 || diff === -1;
  }); // e.g. "0123456789" or "9876543210"
}

/**
 * Indonesian mobile number in any accepted spelling — 08xxxxxxxxxx, 628xxxxxxxxxx or
 * +628xxxxxxxxxx (spaces, dashes, dots and parentheses allowed). Returns the national number
 * without the 0 / 62 prefix ("8…", 9–13 digits after the leading 8), or null when the value is
 * not an Indonesian mobile number.
 */
function indonesianNationalNumber(value: string): string | null {
  const trimmed = value.trim();
  if (/[^\d\s\-.()+]/.test(trimmed)) return null;
  const compact = trimmed.replace(/[\s\-.()]/g, "");
  const match = /^(?:\+62|62|0)(8\d{9,13})$/.exec(compact);
  return match ? match[1]! : null;
}

/** Normalizes an Indonesian mobile number to "+62…"; any other value is returned trimmed. */
export function normalizePhone(value: string): string {
  const national = indonesianNationalNumber(value);
  return national ? `+62${national}` : value.trim();
}

/**
 * Accepts Indonesian mobile numbers (08…, 628…, +628…) and, for foreign numbers, a plausible
 * international number (8–15 digits). Keyboard-mashing like "0123456789" is rejected in both cases.
 */
export function isValidPhone(value: string): boolean {
  const national = indonesianNationalNumber(value);
  if (national) return !looksLikeKeyboardMash(national);

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;
  return !looksLikeKeyboardMash(digits);
}
