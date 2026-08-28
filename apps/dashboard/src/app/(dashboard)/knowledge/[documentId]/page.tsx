"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/modal";
import { isSuperAdminRole } from "@/lib/is-super-admin";

interface Category {
  id: string;
  name: string;
}

interface KnowledgeDocDetail {
  id: string;
  slug?: string;
  title: string;
  summary?: string | null;
  content: string;
  status: string;
  audience: string;
  version: number;
  categoryId?: string | null;
  category?: Category | null;
  updatedAt: string;
  effectiveDate?: string | null;
  expiredDate?: string | null;
  sourceFile?: string | null;
  chunks: Array<{ id: string; chunkIndex: number }>;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export default function KnowledgeDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = isSuperAdminRole(user?.roles);

  const query = useQuery({
    queryKey: ["knowledge", documentId],
    queryFn: () => apiClient.get<KnowledgeDocDetail>(`/api/v1/knowledge/documents/${documentId}`),
  });
  const categories = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: () => apiClient.get<Category[]>("/api/v1/knowledge/categories"),
  });
  const wikilinkTargets = useQuery({
    queryKey: ["knowledge-wikilink-targets"],
    queryFn: () => apiClient.get<{ items: Array<{ id: string; title: string; slug?: string | null }> }>("/api/v1/knowledge/documents?pageSize=500"),
  });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [audience, setAudience] = useState("PUBLIC");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiredDate, setExpiredDate] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (query.data) {
      setTitle(query.data.title);
      setSummary(query.data.summary ?? "");
      setContent(query.data.content);
      setCategoryId(query.data.categoryId ?? "");
      setAudience(query.data.audience);
      setEffectiveDate(query.data.effectiveDate ? query.data.effectiveDate.slice(0, 10) : "");
      setExpiredDate(query.data.expiredDate ? query.data.expiredDate.slice(0, 10) : "");
    }
  }, [query.data]);

  function useAction(fn: () => Promise<unknown>, successMessage: string) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.push(successMessage, "success");
        queryClient.invalidateQueries({ queryKey: ["knowledge", documentId] });
        queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      },
      onError: (err) => toast.push(err instanceof ApiError ? err.message : "Aksi gagal.", "error"),
    });
  }

  const save = useAction(
    () =>
      apiClient.put(`/api/v1/knowledge/documents/${documentId}`, {
        title,
        summary: summary || undefined,
        content,
        categoryId: categoryId || undefined,
        audience,
        effectiveDate: effectiveDate || undefined,
        expiredDate: expiredDate || undefined,
      }),
    "Perubahan disimpan.",
  );
  const activate = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/activate`), "Artikel diaktifkan.");
  const deactivate = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/deactivate`), "Artikel dinonaktifkan.");
  const reprocess = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/reprocess`), "Index knowledge diperbarui.");
  const removeArticle = useMutation({
    mutationFn: () => apiClient.delete<{ id: string }>(`/api/v1/knowledge/documents/${documentId}`),
    onSuccess: () => {
      toast.push("Artikel dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      router.replace("/knowledge");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus artikel.", "error"),
  });

  if (!query.data) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat...</div>;
  const doc = query.data;
  const editable = isSuperAdmin;

  return (
    <>
      <Topbar title={doc.title} />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 xl:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <Link href="/knowledge" className="text-sm text-zinc-500 hover:text-zinc-300">
              {"<"} Kembali ke Knowledge Base
            </Link>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{doc.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">Kelola konten markdown dan status aktif/non-aktif dari satu layar kerja.</p>
          </div>
          <Badge tone="gold">{doc.status}</Badge>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <Card className="self-start overflow-hidden border-ink-500/60 bg-ink-800/75 !p-0">
            <div className="border-b border-ink-700 px-5 py-4">
              <Label htmlFor="title">Judul Artikel</Label>
              <Input id="title" value={title} disabled={!editable} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="px-5 py-5">
              <Label htmlFor="content">Isi Artikel Markdown</Label>
              <p className="mb-3 text-xs text-zinc-500">Editor menggunakan library pihak ketiga `@uiw/react-md-editor`. Gunakan mode split untuk mengecek preview tanpa keluar dari editor.</p>
              <MarkdownEditor
                id="content"
                value={content}
                disabled={!editable}
                rows={18}
                wikilinkTargets={wikilinkTargets.data?.items ?? []}
                placeholder={`# Judul artikel

Tulis isi knowledge di sini...`}
                onChange={setContent}
              />
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="border-ink-500/60 bg-ink-800/75">
              <CardHeader>
                <CardTitle>Metadata Artikel</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="summary">Ringkasan</Label>
                  <Textarea
                    id="summary"
                    rows={4}
                    value={summary}
                    disabled={!editable}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Ringkasan singkat untuk reviewer dan daftar knowledge."
                  />
                </div>
                <div>
                  <Label htmlFor="category">Kategori</Label>
                  <Select id="category" value={categoryId} disabled={!editable} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">- Tanpa kategori -</option>
                    {categories.data?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="audience">Audience</Label>
                  <Select id="audience" value={audience} disabled={!editable} onChange={(e) => setAudience(e.target.value)}>
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="AGENT_ONLY">AGENT_ONLY</option>
                    <option value="INTERNAL">INTERNAL</option>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="effectiveDate">Aktif Mulai</Label>
                    <Input id="effectiveDate" type="date" disabled={!editable} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="expiredDate">Berakhir Pada</Label>
                    <Input id="expiredDate" type="date" disabled={!editable} value={expiredDate} onChange={(e) => setExpiredDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-ink-500/60 bg-ink-800/75">
              <CardHeader>
                <CardTitle>Status & Index</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <Badge tone="gold">{doc.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Versi</span>
                  <span className="text-zinc-200">v{doc.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Chunk Index</span>
                  <span className="text-zinc-200">{doc.chunks.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Diperbarui</span>
                  <span className="text-right text-zinc-200">{formatDate(doc.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Source File</span>
                  <span className="max-w-[150px] truncate text-right text-zinc-200">{doc.sourceFile ?? "Manual editor"}</span>
                </div>
              </div>
            </Card>

            <Card className="border-ink-500/60 bg-ink-800/75">
              <CardHeader>
                <CardTitle>Aksi Knowledge</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-2">
                {isSuperAdmin && (
                  <Button variant="secondary" onClick={() => save.mutate()}>
                    Simpan Perubahan
                  </Button>
                )}
                {isSuperAdmin && doc.status !== "ACTIVE" && <Button onClick={() => activate.mutate()}>Aktifkan untuk AI</Button>}
                {isSuperAdmin && doc.status === "ACTIVE" && (
                  <Button variant="ghost" onClick={() => deactivate.mutate()}>
                    Nonaktifkan
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button variant="ghost" onClick={() => reprocess.mutate()}>
                    Reprocess Index
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                    Hapus Permanen
                  </Button>
                )}
                {!isSuperAdmin && <p className="text-sm leading-6 text-zinc-400">Mode baca saja. Hanya Super Admin yang dapat mengubah Knowledge Base.</p>}
              </div>
            </Card>
          </div>
        </div>
      </main>
      <ConfirmModal
        open={deleteOpen}
        title="Hapus artikel knowledge?"
        description="Artikel, versi, dan chunk knowledge yang terkait akan dihapus permanen."
        confirmLabel={removeArticle.isPending ? "Menghapus..." : "Hapus Permanen"}
        danger
        onConfirm={() => removeArticle.mutate()}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
