"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { rewriteWikiLinksToMarkdown, type KnowledgeLinkTarget } from "@solidchat/shared";
import { Button } from "./button";
import { cn } from "./cn";

const MDEditor = dynamic(() => import("@uiw/react-md-editor").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="min-h-[720px] animate-pulse rounded-xl border border-ink-600 bg-ink-800/70 p-4 text-sm text-zinc-500">
      Memuat editor markdown...
    </div>
  ),
});

type MarkdownPreviewProps = {
  source: string;
};

const MarkdownPreview = dynamic(
  () =>
    import("@uiw/react-md-editor").then(
      (mod) => (mod.default as unknown as { Markdown: ComponentType<MarkdownPreviewProps> }).Markdown,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[720px] animate-pulse rounded-xl border border-ink-600 bg-ink-800/70 p-4 text-sm text-zinc-500">
        Memuat editor markdown...
      </div>
    ),
  },
);

type MarkdownEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  rows?: number;
  className?: string;
  wikilinkTargets?: KnowledgeLinkTarget[];
  wikilinkBasePath?: string;
};

export function MarkdownEditor({
  id,
  value,
  onChange,
  disabled,
  required,
  minLength,
  placeholder,
  rows = 16,
  className,
  wikilinkTargets = [],
  wikilinkBasePath = "/knowledge",
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState<"live" | "edit" | "preview">("live");
  const editorHeight = useMemo(() => Math.max(rows * 36, 720), [rows]);
  const stats = `${value.length} karakter | ${value ? value.split("\n").length : 1} baris`;
  const previewSource = useMemo(
    () => rewriteWikiLinksToMarkdown(value, wikilinkTargets, wikilinkBasePath),
    [value, wikilinkTargets, wikilinkBasePath],
  );
  const editorProps = {
    id,
    value,
    height: editorHeight,
    minHeight: editorHeight,
    visibleDragbar: false,
    textareaProps: {
      id,
      disabled,
      required,
      minLength,
      placeholder,
    },
    previewOptions: {
      style: { backgroundColor: "transparent", padding: 0 },
      disallowedElements: ["style", "script"],
    },
    onChange: (nextValue?: string) => onChange(nextValue ?? ""),
  };

  return (
    <div data-color-mode="dark" className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-ink-600 bg-ink-800/70 p-1">
          {[
            { key: "live", label: "Split" },
            { key: "edit", label: "Editor" },
            { key: "preview", label: "Preview" },
          ].map((mode) => (
            <Button
              key={mode.key}
              type="button"
              size="sm"
              variant={preview === mode.key ? "secondary" : "ghost"}
              onClick={() => setPreview(mode.key as "live" | "edit" | "preview")}
              disabled={disabled && mode.key === "edit"}
            >
              {mode.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1">{stats}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(`${value}${value ? "\n\n" : ""}---\n\n## Catatan\n`)}
          >
            Sisipkan Section
          </Button>
          <span className="rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1">
            Wikilink: <code>[[Judul Artikel]]</code> atau <code>[[Judul Artikel|Alias]]</code>
          </span>
        </div>
      </div>

      {preview === "edit" ? (
        <MDEditor {...editorProps} preview="edit" />
      ) : preview === "preview" ? (
        <div className="min-h-[720px] overflow-auto rounded-xl border border-ink-600 bg-ink-800/70 p-4">
          <MarkdownPreview source={previewSource} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <MDEditor {...editorProps} preview="edit" />
          <div className="min-h-[720px] overflow-auto rounded-xl border border-ink-600 bg-ink-800/70 p-4">
            <MarkdownPreview source={previewSource} />
          </div>
        </div>
      )}
    </div>
  );
}
