import { useState } from "react";
import { MailCheck } from "lucide-react";
import { ApiError } from "../lib/api";

export interface TicketValues {
  name: string;
  email: string;
  phone: string;
  subject: string;
  description: string;
  category: string;
}

const CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "Pertanyaan Umum" },
  { value: "SALES", label: "Penjualan / Harga" },
  { value: "SUPPORT", label: "Bantuan Teknis" },
  { value: "COMPLAINT", label: "Keluhan" },
];

const DEFAULT_CATEGORY = CATEGORY_OPTIONS[0]?.value ?? "GENERAL";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 8;
}

export function TicketForm({
  onSubmit,
  onSendAnother,
  widgetColor,
  offlineMessage,
}: {
  onSubmit: (values: TicketValues) => Promise<string>;
  onSendAnother?: () => void;
  widgetColor: string;
  offlineMessage?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  const trimmedSubject = subject.trim();
  const trimmedDescription = description.trim();
  const emailValid = isValidEmail(trimmedEmail);
  const phoneValid = isValidPhone(trimmedPhone);
  const canSubmit =
    trimmedName.length > 0 &&
    emailValid &&
    phoneValid &&
    trimmedSubject.length > 0 &&
    trimmedDescription.length >= 5 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const number = await onSubmit({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        subject: trimmedSubject,
        description: trimmedDescription,
        category,
      });
      setTicketNumber(number);
    } catch (submitError) {
      if (submitError instanceof ApiError || submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Tiket belum bisa dikirim. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSendAnother() {
    setName("");
    setEmail("");
    setPhone("");
    setCategory(DEFAULT_CATEGORY);
    setSubject("");
    setDescription("");
    setError(null);
    setTicketNumber(null);
    onSendAnother?.();
  }

  if (ticketNumber) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${widgetColor}22` }}>
          <MailCheck className="h-7 w-7" style={{ color: widgetColor }} />
        </div>
        <p className="text-sm font-semibold text-white">Tiket Anda berhasil dikirim</p>
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium tracking-wide text-zinc-300">
          {ticketNumber}
        </p>
        <p className="max-w-[85%] text-xs leading-relaxed text-zinc-500">
          Tim kami sedang tidak online, tetapi akan menghubungi Anda melalui email atau telepon secepatnya.
        </p>
        <button
          onClick={handleSendAnother}
          className="rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-semibold text-ink shadow-lg"
        >
          Kirim tiket lagi
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto bg-ink px-5 py-4">
      <div className="mb-1 text-center">
        <p className="text-sm font-medium text-zinc-200">Tim kami sedang offline</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {offlineMessage || "Tinggalkan pesan Anda di bawah ini dan tim kami akan menghubungi Anda kembali."}
        </p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama Anda"
        disabled={submitting}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        disabled={submitting}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      {trimmedEmail.length > 0 && !emailValid ? <p className="text-[11px] text-rose-400">Masukkan alamat email yang valid.</p> : null}
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="No. Telepon / WhatsApp"
        disabled={submitting}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      {trimmedPhone.length > 0 && !phoneValid ? <p className="text-[11px] text-rose-400">Masukkan nomor telepon yang valid.</p> : null}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        disabled={submitting}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
      >
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subjek"
        disabled={submitting}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ceritakan kebutuhan Anda..."
        rows={4}
        disabled={submitting}
        className="resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      {error ? <p className="text-center text-[11px] text-rose-400">{error}</p> : null}
      <button
        disabled={!canSubmit}
        onClick={() => {
          handleSubmit().catch(() => undefined);
        }}
        className="mt-1 rounded-lg py-2 text-sm font-medium text-ink disabled:opacity-40"
        style={{ backgroundColor: widgetColor }}
      >
        {submitting ? "Mengirim..." : "Kirim Tiket"}
      </button>
    </div>
  );
}
