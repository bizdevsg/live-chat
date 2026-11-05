export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Accepts real-looking phone numbers while rejecting obvious keyboard-mashing like
 * "4444444144" or "0123456789" that previously passed the old "8+ digits" check.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;

  const digitCounts = new Map<string, number>();
  for (const digit of digits) digitCounts.set(digit, (digitCounts.get(digit) ?? 0) + 1);
  const mostRepeatedDigitCount = Math.max(...digitCounts.values());
  if (mostRepeatedDigitCount / digits.length >= 0.7) return false; // e.g. "4444444144"

  const isSequentialRun = [...digits].every((digit, index) => {
    if (index === 0) return true;
    const diff = Number(digit) - Number(digits[index - 1]);
    return diff === 1 || diff === -1;
  });
  if (isSequentialRun) return false; // e.g. "0123456789" or "9876543210"

  return true;
}
