import { useState } from "react";

export interface PreChatValues {
  name: string;
  email?: string;
  phone?: string;
  consentGiven: boolean;
}

export function PreChatForm({ onSubmit, widgetColor }: { onSubmit: (values: PreChatValues) => void; widgetColor: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  return (
    <div className="flex h-full flex-col justify-center gap-3 bg-ink px-5">
      <p className="mb-1 text-center text-sm text-zinc-300">Sebelum memulai, boleh kami tahu sedikit tentang Anda?</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama Anda"
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (opsional)"
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Nomor WhatsApp (opsional)"
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
      />
      <label className="flex items-start gap-2 text-[11px] text-zinc-500">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        Saya menyetujui data ini digunakan sesuai kebijakan privasi Solid Gold.
      </label>
      <button
        disabled={!name.trim() || !consent}
        onClick={() => onSubmit({ name, email: email || undefined, phone: phone || undefined, consentGiven: consent })}
        className="rounded-lg py-2 text-sm font-medium text-ink disabled:opacity-40"
        style={{ backgroundColor: widgetColor }}
      >
        Mulai Chat
      </button>
    </div>
  );
}
