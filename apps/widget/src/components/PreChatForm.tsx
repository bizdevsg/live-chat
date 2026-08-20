import { useState } from "react";
import { ApiError } from "../lib/api";

export interface PreChatValues {
  name: string;
  email: string;
  phone: string;
  consentGiven: boolean;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 8;
}

export function PreChatForm({
  onSubmit,
  widgetColor,
  disabled = false,
}: {
  onSubmit: (values: PreChatValues) => Promise<void>;
  widgetColor: string;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  const emailValid = isValidEmail(trimmedEmail);
  const phoneValid = isValidPhone(trimmedPhone);
  const canSubmit = trimmedName.length > 0 && trimmedEmail.length > 0 && trimmedPhone.length > 0 && emailValid && phoneValid && consent && !disabled && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmedName, email: trimmedEmail, phone: trimmedPhone, consentGiven: consent });
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Data belum bisa dikirim. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3 bg-ink px-5">
      <p className="mb-1 text-center text-sm text-zinc-300">Sebelum memulai, boleh kami tahu sedikit tentang Anda?</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama Anda"
        disabled={submitting || disabled}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        disabled={submitting || disabled}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      {trimmedEmail.length > 0 && !emailValid ? <p className="-mt-1 text-[11px] text-rose-400">Masukkan alamat email yang valid.</p> : null}
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="No. Telepon / WhatsApp"
        disabled={submitting || disabled}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      {trimmedPhone.length > 0 && !phoneValid ? <p className="-mt-1 text-[11px] text-rose-400">Masukkan nomor telepon yang valid.</p> : null}
      <label className="flex items-start gap-2 text-[11px] text-zinc-500">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" disabled={submitting || disabled} />
        Saya menyetujui data ini digunakan sesuai kebijakan privasi Solid Gold.
      </label>
      {error ? <p className="text-center text-[11px] text-rose-400">{error}</p> : null}
      <button
        disabled={!canSubmit}
        onClick={() => {
          handleSubmit().catch(() => undefined);
        }}
        className="rounded-lg py-2 text-sm font-medium text-ink disabled:opacity-40"
        style={{ backgroundColor: widgetColor }}
      >
        {submitting ? "Mengirim..." : "Mulai Chat"}
      </button>
    </div>
  );
}

