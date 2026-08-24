import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SiteConfig } from "../hooks/use-widget-session";
import { Headset, Send } from "lucide-react";

const COMPOSER_MIN_HEIGHT = 46;
const COMPOSER_MAX_LINES = 3;
const COMPOSER_LINE_HEIGHT = 20;
const COMPOSER_VERTICAL_PADDING = 24;
const COMPOSER_BORDER = 2;
const COMPOSER_MAX_HEIGHT =
  COMPOSER_MAX_LINES * COMPOSER_LINE_HEIGHT +
  COMPOSER_VERTICAL_PADDING +
  COMPOSER_BORDER;

export function Composer({
  onSend,
  onTyping,
  onRequestAgent,
  config,
  disabled,
  canRequestAgent,
}: {
  onSend: (content: string) => void;
  onTyping: (typing: boolean) => void;
  onRequestAgent: () => void;
  config: SiteConfig;
  disabled: boolean;
  /** False until the AI has actually replied, and again once an agent is queued/assigned. */
  canRequestAgent: boolean;
}) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, COMPOSER_MIN_HEIGHT), COMPOSER_MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [resizeTextarea, value]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

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
      {config.settings?.showAgentButton && canRequestAgent && (
        <button
          onClick={onRequestAgent}
          className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400 underline decoration-dotted underline-offset-2 hover:text-white"
        >
          <Headset className="h-3.5 w-3.5" />
          Bicara dengan petugas kami
        </button>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            resizeTextarea(e.currentTarget);
            handleChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Tulis pesan..."
          rows={1}
          className="scrollbar-composer block min-h-11 w-full flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-5 text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none box-border"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Kirim pesan"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full text-ink disabled:opacity-40"
          style={{ backgroundColor: config.widgetColor }}
        >
          {/* Explicit size: lucide defaults to 24px, which crowds this 36px button. */}
          <Send className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-zinc-600">Percakapan dapat dibaca oleh AI dan petugas resmi Solid Gold.</p>
    </div>
  );
}
