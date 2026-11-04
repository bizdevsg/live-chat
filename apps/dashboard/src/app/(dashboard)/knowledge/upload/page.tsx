"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, UploadCloud } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmModal } from "@/components/ui/modal";
import { FormPage, FormSection } from "@/components/layout/form-page";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";

const MAX_BATCH_UPLOAD_FILES = 50;
// Auth, permission, or throttle failures would repeat for every remaining file, so the batch stops there.
const STOP_BATCH_UPLOAD_STATUSES = [401, 403, 429];

interface UploadFailure {
  name: string;
  reason: string;
}

interface UploadReport {
  succeeded: number;
  overwritten: number;
  failed: UploadFailure[];
}

interface UploadConflict {
  id: string;
  fileName: string;
  title: string;
  status: string;
  version: number;
}

export default function UploadKnowledgePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = isSuperAdminRole(user?.roles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadReport, setUploadReport] = useState<UploadReport | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [uploadConflicts, setUploadConflicts] = useState<UploadConflict[]>([]);
  const [isCheckingUploadConflicts, setIsCheckingUploadConflicts] = useState(false);

  const upload = useMutation({
    mutationFn: async ({ selected, overwriteFileNames }: { selected: File[]; overwriteFileNames: string[] }): Promise<UploadReport> => {
      const failed: UploadFailure[] = [];
      const markdownFiles: File[] = [];
      for (const file of selected) {
        if (file.name.toLowerCase().endsWith(".md")) markdownFiles.push(file);
        else failed.push({ name: file.name, reason: "Knowledge hanya menerima file Markdown (.md)." });
      }
      const queue = markdownFiles.slice(0, MAX_BATCH_UPLOAD_FILES);
      for (const file of markdownFiles.slice(MAX_BATCH_UPLOAD_FILES)) {
        failed.push({ name: file.name, reason: `Melebihi batas ${MAX_BATCH_UPLOAD_FILES} file per unggahan.` });
      }

      // Sequential on purpose: the API slugs titles with check-then-insert, so parallel uploads of
      // same-named files could collide, and the global throttle allows 120 requests per minute.
      let succeeded = 0;
      let overwritten = 0;
      const overwriteNames = new Set(overwriteFileNames.map((name) => name.toLocaleLowerCase("id-ID")));
      setUploadProgress({ done: 0, total: queue.length });
      for (const [index, file] of queue.entries()) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const shouldOverwrite = overwriteNames.has(file.name.toLocaleLowerCase("id-ID"));
          const result = await apiClient.upload<{ overwritten?: boolean }>(
            `/api/v1/knowledge/upload${shouldOverwrite ? "?overwrite=true" : ""}`,
            formData,
          );
          succeeded += 1;
          if (result.overwritten) overwritten += 1;
        } catch (err) {
          failed.push({ name: file.name, reason: err instanceof ApiError ? err.message : "Gagal mengunggah dokumen." });
          if (err instanceof ApiError && STOP_BATCH_UPLOAD_STATUSES.includes(err.status)) {
            for (const skipped of queue.slice(index + 1)) {
              failed.push({ name: skipped.name, reason: "Tidak diproses karena unggahan dihentikan." });
            }
            break;
          }
        }
        setUploadProgress({ done: index + 1, total: queue.length });
      }
      return { succeeded, overwritten, failed };
    },
    onSuccess: (report) => {
      setIsDraggingFiles(false);
      setSelectedUploadFiles([]);
      setUploadConflicts([]);
      if (report.succeeded > 0) {
        queryClient.invalidateQueries({ queryKey: ["knowledge"] });
        queryClient.invalidateQueries({ queryKey: ["knowledge-overview"] });
      }
      if (report.failed.length === 0) {
        toast.push(
          report.succeeded === 1
            ? report.overwritten === 1
              ? "Dokumen lama berhasil ditimpa dan dinonaktifkan untuk diperiksa ulang."
              : "Dokumen markdown berhasil diunggah sebagai NON_ACTIVE."
            : `${report.succeeded} dokumen berhasil diproses (${report.overwritten} ditimpa).`,
          "success",
        );
        router.push("/knowledge");
      } else if (report.succeeded === 0 && report.failed.length === 1 && report.failed[0]) {
        toast.push(report.failed[0].reason, "error");
      } else {
        setUploadReport(report);
      }
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mengunggah dokumen.", "error"),
    onSettled: () => setUploadProgress(null),
  });

  function stageUploadFiles(files: File[]) {
    if (upload.isPending || isCheckingUploadConflicts || files.length === 0) return;
    setUploadReport(null);
    const markdownFiles = files.filter((file) => file.name.toLowerCase().endsWith(".md"));
    const rejectedCount = files.length - markdownFiles.length;
    const uniqueByName = new Map<string, File>();
    for (const file of markdownFiles) uniqueByName.set(file.name.toLocaleLowerCase("id-ID"), file);
    const deduplicatedFiles = [...uniqueByName.values()];
    const acceptedFiles = deduplicatedFiles.slice(0, MAX_BATCH_UPLOAD_FILES);

    if (rejectedCount > 0) {
      toast.push(`${rejectedCount} file dilewati karena bukan Markdown (.md).`, "error");
    }
    if (deduplicatedFiles.length < markdownFiles.length) {
      toast.push(`${markdownFiles.length - deduplicatedFiles.length} file duplikat dalam pilihan dilewati.`, "error");
    }
    if (deduplicatedFiles.length > MAX_BATCH_UPLOAD_FILES) {
      toast.push(`Maksimal ${MAX_BATCH_UPLOAD_FILES} file dapat diunggah sekaligus.`, "error");
    }
    setUploadConflicts([]);
    setSelectedUploadFiles(acceptedFiles);
  }

  async function requestBatchUpload() {
    if (selectedUploadFiles.length === 0 || upload.isPending || isCheckingUploadConflicts) return;
    setIsCheckingUploadConflicts(true);
    try {
      const result = await apiClient.post<{ conflicts: UploadConflict[] }>("/api/v1/knowledge/upload-conflicts", {
        fileNames: selectedUploadFiles.map((file) => file.name),
      });
      if (result.conflicts.length > 0) {
        setUploadConflicts(result.conflicts);
        return;
      }
      upload.mutate({ selected: selectedUploadFiles, overwriteFileNames: [] });
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : "Gagal memeriksa file knowledge yang sudah ada.", "error");
    } finally {
      setIsCheckingUploadConflicts(false);
    }
  }

  function handleFileDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!upload.isPending && event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setIsDraggingFiles(true);
    }
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    stageUploadFiles(Array.from(event.dataTransfer.files));
  }

  const busy = upload.isPending || isCheckingUploadConflicts;

  return (
    <FormPage
      topbarTitle="Upload Knowledge"
      title="Upload knowledge"
      description="Upload satu atau beberapa file Markdown. Semua artikel baru akan disimpan sebagai NON_ACTIVE agar dapat diperiksa sebelum dipakai AI."
      backHref="/knowledge"
      backLabel="Kembali ke Knowledge Base"
    >
      {!isSuperAdmin ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 px-5 py-10 text-center text-sm text-zinc-500">
          Hanya Super Admin yang dapat mengunggah knowledge.
        </div>
      ) : (
        <div className="space-y-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              stageUploadFiles(files);
            }}
          />

          <FormSection title="File Markdown">
            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              aria-label="Upload file Markdown dengan drag and drop atau pilih file"
              onClick={() => {
                if (!busy) fileInputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (!busy && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={handleFileDrag}
              onDragOver={handleFileDrag}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const nextTarget = event.relatedTarget;
                if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsDraggingFiles(false);
              }}
              onDrop={handleFileDrop}
              className={cn(
                "flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold-500/60",
                isDraggingFiles
                  ? "border-gold-400 bg-gold-500/10"
                  : "border-ink-500 bg-ink-900/45 hover:border-gold-500/50 hover:bg-ink-900/70",
                busy && "cursor-wait opacity-75",
              )}
            >
              {upload.isPending ? (
                <LoaderCircle className="h-10 w-10 animate-spin text-gold-400" aria-hidden="true" />
              ) : (
                <UploadCloud className={cn("h-10 w-10", isDraggingFiles ? "text-gold-300" : "text-zinc-400")} aria-hidden="true" />
              )}
              <p className="mt-4 text-sm font-semibold text-zinc-100">
                {upload.isPending && uploadProgress
                  ? `Mengunggah ${uploadProgress.done} dari ${uploadProgress.total} file...`
                  : isDraggingFiles
                    ? "Lepaskan file untuk mulai mengunggah"
                    : selectedUploadFiles.length > 0
                      ? `${selectedUploadFiles.length} file siap diunggah`
                      : "Tarik & lepas file Markdown di sini"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {upload.isPending
                  ? "Jangan tutup halaman sampai proses selesai."
                  : selectedUploadFiles.length > 0
                    ? "Klik area ini untuk mengganti pilihan file."
                    : `atau klik untuk memilih hingga ${MAX_BATCH_UPLOAD_FILES} file .md`}
              </p>
            </div>

            {selectedUploadFiles.length > 0 && !upload.isPending && (
              <div className="rounded-xl border border-ink-600 bg-ink-900/45">
                <div className="flex items-center justify-between border-b border-ink-600 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-300">File terpilih</p>
                  <button
                    type="button"
                    onClick={() => setSelectedUploadFiles([])}
                    disabled={isCheckingUploadConflicts}
                    className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                  >
                    Hapus pilihan
                  </button>
                </div>
                <ul className="scrollbar-thin max-h-48 overflow-y-auto px-3 py-2">
                  {selectedUploadFiles.map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 py-1 text-xs">
                      <span className="min-w-0 truncate text-zinc-300">{file.name}</span>
                      <span className="shrink-0 text-zinc-600">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </FormSection>

          {uploadReport && (
            <FormSection title="Hasil upload Markdown">
              <p className="text-sm text-zinc-300">
                {uploadReport.succeeded} file berhasil diproses sebagai NON_ACTIVE
                {uploadReport.overwritten > 0 ? ` (${uploadReport.overwritten} file lama ditimpa)` : ""}, {uploadReport.failed.length} file gagal.
              </p>
              <ul className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto">
                {uploadReport.failed.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
                    <p className="break-all text-sm font-medium text-red-200">{item.name}</p>
                    <p className="mt-0.5 text-xs text-red-300/80">{item.reason}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setUploadReport(null)}>
                  Tutup laporan
                </Button>
                <Link href="/knowledge">
                  <Button>Ke Knowledge Base</Button>
                </Link>
              </div>
            </FormSection>
          )}

          <div className="flex items-center justify-end gap-2">
            <Link href="/knowledge" aria-disabled={busy} tabIndex={busy ? -1 : undefined} className={cn(busy && "pointer-events-none opacity-50")}>
              <Button type="button" variant="secondary" disabled={busy}>
                Batal
              </Button>
            </Link>
            <Button onClick={() => requestBatchUpload().catch(() => undefined)} disabled={busy || selectedUploadFiles.length === 0}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {upload.isPending
                ? "Mengunggah..."
                : isCheckingUploadConflicts
                  ? "Memeriksa file..."
                  : `Konfirmasi Upload${selectedUploadFiles.length > 0 ? ` (${selectedUploadFiles.length})` : ""}`}
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={uploadConflicts.length > 0}
        title={`Timpa ${uploadConflicts.length} knowledge yang sudah ada?`}
        description={
          uploadConflicts.length > 0
            ? `File berikut sudah ada: ${uploadConflicts.slice(0, 5).map((item) => item.fileName).join(", ")}${uploadConflicts.length > 5 ? `, dan ${uploadConflicts.length - 5} lainnya` : ""}. Konten lama akan diganti, versi dinaikkan, dan artikel dibuat NON_ACTIVE agar dapat diperiksa sebelum dipakai AI.`
            : ""
        }
        confirmLabel="Ya, Timpa File"
        danger
        onConfirm={() =>
          upload.mutate({
            selected: selectedUploadFiles,
            overwriteFileNames: uploadConflicts.map((item) => item.fileName),
          })
        }
        onClose={() => setUploadConflicts([])}
      />
    </FormPage>
  );
}
