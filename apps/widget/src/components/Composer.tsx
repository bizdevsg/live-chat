import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SiteConfig } from "../hooks/use-widget-session";
import { Headset, ImagePlus, Send, X } from "lucide-react";

const COMPOSER_MIN_HEIGHT = 46;
const COMPOSER_MAX_LINES = 3;
const COMPOSER_LINE_HEIGHT = 20;
const COMPOSER_VERTICAL_PADDING = 24;
const COMPOSER_BORDER = 2;
const COMPOSER_MAX_HEIGHT =
  COMPOSER_MAX_LINES * COMPOSER_LINE_HEIGHT +
  COMPOSER_VERTICAL_PADDING +
  COMPOSER_BORDER;

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function Composer({
  onSend,
  onTyping,
  onRequestAgent,
  onUploadImage,
  config,
  disabled,
  canRequestAgent,
  canUploadImage,
}: {
  onSend: (content: string) => void;
  onTyping: (typing: boolean) => void;
  onRequestAgent: () => void;
  onUploadImage: (file: File, content: string) => Promise<void>;
  config: SiteConfig;
  disabled: boolean;
  /** False until the AI has actually replied, and again once an agent is queued/assigned. */
  canRequestAgent: boolean;
  canUploadImage: boolean;
}) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // A picked image waits here until the visitor hits Send, so it goes out together with whatever
  // caption they type instead of firing off on its own the moment it's chosen.
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const agentButtonLabel = config.settings?.agentButtonLabel?.trim() || "Hubungi Agent Kami";

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

  // Release the object URL when the staged image is swapped out or the composer unmounts.
  useEffect(() => {
    if (!pendingImage) return;
    return () => URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  // If the agent hands the conversation back to the AI mid-compose, image upload is no longer
  // allowed — drop the staged attachment so the visitor isn't left with something unsendable.
  useEffect(() => {
    if (!canUploadImage) setPendingImage(null);
  }, [canUploadImage]);

  function handleChange(v: string) {
    setValue(v);
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  }

  function stageImage(file: File | undefined) {
    if (!file || !canUploadImage || disabled || uploading) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Format gambar harus PNG, JPEG, atau WEBP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Ukuran gambar maksimal 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadError(null);
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    // Reset the native input so re-picking the same file still fires a change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearPendingImage() {
    setPendingImage(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit() {
    if (disabled || uploading) return;
    const trimmed = value.trim();

    if (pendingImage) {
      setUploadError(null);
      setUploading(true);
      try {
        await onUploadImage(pendingImage.file, trimmed);
        setPendingImage(null);
        setValue("");
        onTyping(false);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Gagal mengirim gambar. Coba lagi.");
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    onTyping(false);
  }

  const canSubmit = !disabled && !uploading && (!!value.trim() || !!pendingImage);

  return (
    <div className="border-t border-zinc-800 bg-ink p-3">
      {config.settings?.showAgentButton && canRequestAgent && (
        <button
          onClick={onRequestAgent}
          className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400 underline decoration-dotted underline-offset-2 hover:text-white"
        >
          <Headset className="h-3.5 w-3.5" />
          {agentButtonLabel}
        </button>
      )}
      {pendingImage ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-2">
          <img src={pendingImage.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">Gambar akan dikirim bersama pesan</span>
          <button
            onClick={clearPendingImage}
            disabled={uploading}
            aria-label="Hapus gambar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        {canUploadImage ? (
          <button onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading || !!pendingImage} aria-label="Lampirkan gambar" className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border border-zinc-700 text-zinc-200 disabled:opacity-40">
            <ImagePlus className="h-4 w-4" />
          </button>
        ) : null}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => stageImage(event.target.files?.[0])} />
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
              void submit();
            }
          }}
          placeholder={pendingImage ? "Tambahkan pesan (opsional)..." : "Tulis pesan..."}
          rows={1}
          className="scrollbar-composer block min-h-11 w-full flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-5 text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none box-border"
        />
        <button
          onClick={() => void submit()}
          disabled={!canSubmit}
          aria-label="Kirim pesan"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full text-ink disabled:opacity-40"
          style={{ backgroundColor: config.widgetColor }}
        >
          {/* Explicit size: lucide defaults to 24px, which crowds this 36px button. */}
          <Send className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
      {uploading ? <p className="mt-2 text-center text-[10px] text-zinc-400">Mengirim gambar...</p> : null}
      {uploadError ? <p role="alert" className="mt-2 text-center text-[10px] text-red-400">{uploadError}</p> : null}
      <p className="mt-2 text-center text-[10px] text-zinc-600">Percakapan dapat dibaca oleh AI dan petugas resmi Solid Gold.</p>
    </div>
  );
}
