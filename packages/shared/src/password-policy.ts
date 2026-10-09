export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])\S+$/;

export const PASSWORD_REQUIREMENTS = [
  "Minimal 8 karakter",
  "Maksimal 64 karakter",
  "Mengandung minimal 1 huruf besar (A-Z)",
  "Mengandung minimal 1 huruf kecil (a-z)",
  "Mengandung minimal 1 angka (0-9)",
  "Mengandung minimal 1 karakter khusus (! @ # $ % ^ & *)",
  "Tidak boleh mengandung spasi",
  "Password dan konfirmasi password harus sama",
] as const;

export const PASSWORD_COMPLEXITY_MESSAGE =
  "Password harus mengandung huruf besar, huruf kecil, angka, karakter khusus (! @ # $ % ^ & *), dan tidak boleh mengandung spasi.";

export function getPasswordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "Password minimal 8 karakter.";
  if (password.length > PASSWORD_MAX_LENGTH) return "Password maksimal 64 karakter.";
  if (!/[A-Z]/.test(password)) return "Password harus mengandung minimal 1 huruf besar (A-Z).";
  if (!/[a-z]/.test(password)) return "Password harus mengandung minimal 1 huruf kecil (a-z).";
  if (!/\d/.test(password)) return "Password harus mengandung minimal 1 angka (0-9).";
  if (!/[!@#$%^&*]/.test(password)) {
    return "Password harus mengandung minimal 1 karakter khusus (! @ # $ % ^ & *).";
  }
  if (/\s/.test(password)) return "Password tidak boleh mengandung spasi.";
  return null;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordPolicyError(password) === null;
}
