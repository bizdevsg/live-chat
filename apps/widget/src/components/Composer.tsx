import { useRef, useState } from "react";
import type { SiteConfig } from "../hooks/use-widget-session";

export function Composer({
  onSend,
  onTyping,
  onRequestAgent,
  config,
  disabled,
}: {
  onSend: (content: string) => void;
  onTyping: (typing: boolean) => void;
  onRequestAgent: () => void;
  config: SiteConfig;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    setValue(v);
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    onTyping(false);
  }

  return (
    <div className="border-t border-zinc-800 bg-ink p-3">
      {config.settings?.showAgentButton && (
        <button onClick={onRequestAgent} className="mb-2 text-xs text-zinc-400 underline decoration-dotted hover:text-white">
          Bicara dengan petugas kami
        </button>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Tulis pesan…"
          rows={1}
          className="max-h-24 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Kirim pesan"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink disabled:opacity-40"
          style={{ backgroundColor: config.widgetColor }}
        >
          ➤
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-zinc-600">Percakapan dapat dibaca oleh AI dan petugas resmi Solid Gold.</p>
    </div>
  );
}
