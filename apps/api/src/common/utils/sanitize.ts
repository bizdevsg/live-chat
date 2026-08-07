/** Strips HTML tags and non-printable control characters from user-submitted chat text (defense-in-depth XSS guard, §31). */
export function sanitizePlainText(input: string): string {
  let result = "";
  for (const char of input.replace(/<[^>]*>/g, "")) {
    const code = char.codePointAt(0) ?? 0;
    const isControl = code < 0x20 && char !== "\n" && char !== "\t";
    if (!isControl) result += char;
  }
  return result.trim();
}

export function truncate(input: string, maxLength: number): string {
  return input.length > maxLength ? `${input.slice(0, maxLength)}…` : input;
}
