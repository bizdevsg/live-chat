"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface DraftTemplate {
  shortcut: string;
  title: string;
  content: string;
  language: string;
}

interface BatchResult {
  created: { id: string; shortcut: string }[];
  skipped: { shortcut: string; title: string; reason: string }[];
}

const EMPTY_ROW: DraftTemplate = { shortcut: "", title: "", content: "", language: "id" };
const SAMPLE_JSON = JSON.stringify(
  [
    { shortcut: "salam-pembuka", title: "Salam pembuka", content: "Halo! Ada yang bisa kami bantu?", language: "id" },
    { shortcut: "tunggu-sebentar", title: "Mohon tunggu", content: "Mohon tunggu sebentar, kami cek dulu ya.", language: "id" },
  ],
  null,
  2,
);

/** Accepts an array of loosely-typed objects (from pasted or uploaded JSON) and separates
 *  rows that have the required string fields from rows that don't, with a human-readable
 *  reason per rejected row so the person uploading knows what to fix. */
function parseDraftTemplates(raw: unknown): { valid: DraftTemplate[]; errors: string[] } {
  if (!Array.isArray(raw)) return { valid: [], errors: ["JSON harus berupa array dari objek template."] };

  const valid: DraftTemplate[] = [];
  const errors: string[] = [];
  raw.forEach((entry, index) => {
    const label = `Baris ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label}: bukan objek yang valid.`);
      return;
    }
    const item = entry as Record<string, unknown>;
    const shortcut = typeof item.shortcut === "string" ? item.shortcut.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const content = typeof item.content === "string" ? item.content.trim() : "";
    const language = typeof item.language === "string" && item.language.trim() ? item.language.trim() : "id";
    if (!shortcut || !title || !content) {
      errors.push(`${label}: field "shortcut", "title", dan "content" wajib diisi.`);
      return;
    }
    valid.push({ shortcut, title, content, language });
  });
  return { valid, errors };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function BatchTemplateModal({ open, mode, onClose }: { open: boolean; mode: "manual" | "json"; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<DraftTemplate[]>([{ ...EMPTY_ROW }]);
  const [jsonText, setJsonText] = useState("");
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [jsonPreviewCount, setJsonPreviewCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function resetState() {
    setRows([{ ...EMPTY_ROW }]);
    setJsonText("");
    setJsonErrors([]);
    setJsonPreviewCount(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function updateRow(index: number, patch: Partial<DraftTemplate>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function loadJsonText(text: string) {
    setJsonText(text);
    if (!text.trim()) {
      setJsonErrors([]);
      setJsonPreviewCount(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const { valid, errors } = parseDraftTemplates(parsed);
      setJsonErrors(errors);
      setJsonPreviewCount(valid.length);
    } catch {
      setJsonErrors(["File/teks bukan JSON yang valid."]);
      setJsonPreviewCount(null);
    }
  }

  function handleFileSelect(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => loadJsonText(String(reader.result ?? ""));
    reader.onerror = () => toast.push("Gagal membaca file.", "error");
    reader.readAsText(file);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_JSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "contoh-template.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const batchCreate = useMutation({
    mutationFn: (templates: DraftTemplate[]) => apiClient.post<BatchResult>("/api/v1/admin/templates/batch", { templates }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      const createdCount = result.created.length;
      const skippedCount = result.skipped.length;
      if (skippedCount === 0) {
        toast.push(`${createdCount} template berhasil ditambahkan.`, "success");
      } else {
        toast.push(
          `${createdCount} template ditambahkan, ${skippedCount} dilewati (shortcut sudah dipakai: ${result.skipped.map((s) => s.shortcut).join(", ")}).`,
          createdCount > 0 ? "info" : "error",
        );
      }
      handleClose();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menambahkan template secara batch.", "error"),
  });

  const manualRowsValid = rows.filter((row) => row.shortcut.trim() && row.title.trim() && row.content.trim());
  const jsonValidTemplates = jsonText.trim() ? parseDraftTemplates(safeJsonParse(jsonText)).valid : [];

  function submitManual() {
    if (manualRowsValid.length === 0) {
      toast.push("Isi minimal satu baris (shortcut, judul, isi) sebelum menyimpan.", "error");
      return;
    }
    batchCreate.mutate(manualRowsValid);
  }

  function submitJson() {
    if (jsonErrors.length > 0 || jsonValidTemplates.length === 0) {
      toast.push("Perbaiki isi JSON sebelum menyimpan.", "error");
      return;
    }
    batchCreate.mutate(jsonValidTemplates);
  }

  return (
    <Modal
      open={open}
      title={mode === "manual" ? "Tambah Template (Batch)" : "Upload Template dari JSON"}
      onClose={handleClose}
      panelClassName="max-h-[85vh] max-w-2xl overflow-y-auto"
    >
      <div className="space-y-4 px-5 pb-5">
        {mode === "manual" ? (
          <>
            <p className="text-sm text-zinc-500">Isi beberapa template sekaligus. Baris kosong akan diabaikan.</p>
            <div className="space-y-4">
              {rows.map((row, index) => (
                <div key={index} className="space-y-3 rounded-xl border border-ink-600 bg-ink-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Template #{index + 1}</span>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        aria-label="Hapus baris"
                        className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`shortcut-${index}`}>Shortcut</Label>
                      <Input id={`shortcut-${index}`} placeholder="salam-pembuka" value={row.shortcut} onChange={(e) => updateRow(index, { shortcut: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor={`title-${index}`}>Judul</Label>
                      <Input id={`title-${index}`} value={row.title} onChange={(e) => updateRow(index, { title: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`language-${index}`}>Bahasa</Label>
                    <Select id={`language-${index}`} value={row.language} onChange={(e) => updateRow(index, { language: e.target.value })}>
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`content-${index}`}>Isi</Label>
                    <Textarea id={`content-${index}`} className="min-h-[90px]" value={row.content} onChange={(e) => updateRow(index, { content: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Tambah baris
            </Button>
            <div className="flex items-center justify-between gap-3 border-t border-ink-600 pt-4">
              <p className="text-xs text-zinc-500">{manualRowsValid.length} dari {rows.length} baris siap disimpan.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleClose}>
                  Batal
                </Button>
                <Button onClick={submitManual} disabled={batchCreate.isPending}>
                  {batchCreate.isPending ? "Menyimpan..." : `Simpan ${manualRowsValid.length || ""} Template`}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              Upload file <code className="rounded bg-ink-900 px-1 py-0.5 text-xs text-gold-300">.json</code> berisi array template, atau tempel langsung di bawah.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Pilih file .json
              </Button>
              {fileName ? <span className="text-xs text-zinc-500">{fileName}</span> : null}
              <Button type="button" variant="ghost" size="sm" onClick={downloadSample} className="ml-auto">
                Lihat contoh format
              </Button>
            </div>
            <div>
              <Label htmlFor="json-paste">Isi JSON</Label>
              <Textarea
                id="json-paste"
                className="min-h-[220px] font-mono text-xs"
                placeholder={SAMPLE_JSON}
                value={jsonText}
                onChange={(e) => loadJsonText(e.target.value)}
              />
            </div>
            {jsonErrors.length > 0 ? (
              <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-3 text-xs text-red-300">
                <p className="mb-1 font-semibold">Ditemukan {jsonErrors.length} masalah:</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {jsonErrors.slice(0, 10).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {jsonErrors.length > 10 ? <li>...dan {jsonErrors.length - 10} lainnya.</li> : null}
                </ul>
              </div>
            ) : null}
            {jsonPreviewCount != null && jsonErrors.length === 0 ? (
              <p className="text-xs text-emerald-400">{jsonPreviewCount} template siap diupload.</p>
            ) : null}
            <div className="flex items-center justify-end gap-2 border-t border-ink-600 pt-4">
              <Button variant="secondary" onClick={handleClose}>
                Batal
              </Button>
              <Button onClick={submitJson} disabled={batchCreate.isPending || jsonValidTemplates.length === 0 || jsonErrors.length > 0}>
                {batchCreate.isPending ? "Mengupload..." : `Upload ${jsonValidTemplates.length || ""} Template`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
