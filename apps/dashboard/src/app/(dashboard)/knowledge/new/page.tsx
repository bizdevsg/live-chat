"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";

interface Category {
  id: string;
  name: string;
}

export default function NewKnowledgeArticlePage() {
  const router = useRouter();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [audience, setAudience] = useState("PUBLIC");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiredDate, setExpiredDate] = useState("");
  const isSuperAdmin = isSuperAdminRole(user?.roles);

  const categories = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: () => apiClient.get<Category[]>("/api/v1/knowledge/categories"),
  });
  const wikilinkTargets = useQuery({
    queryKey: ["knowledge-wikilink-targets"],
    queryFn: () => apiClient.get<{ items: Array<{ id: string; title: string; slug?: string | null }> }>("/api/v1/knowledge/documents?pageSize=500"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post<{ id: string }>("/api/v1/knowledge/documents", {
        title,
        summary: summary || undefined,
        content,
        categoryId: categoryId || undefined,
        audience,
        effectiveDate: effectiveDate || undefined,
        expiredDate: expiredDate || undefined,
      }),
    onSuccess: (data) => {
      toast.push("Artikel dibuat sebagai NON_ACTIVE.", "success");
      router.replace(`/knowledge/${data.id}`);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat artikel.", "error"),
  });

  return (
    <>
      <Topbar title="Artikel Baru" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 xl:p-8">
        {!isSuperAdmin ? (
          <Card className="mx-auto max-w-2xl border-ink-500/60 bg-ink-800/75">
            <CardHeader>
              <CardTitle>Akses Dibatasi</CardTitle>
            </CardHeader>
            <p className="text-sm leading-6 text-zinc-400">Hanya Super Admin yang dapat membuat atau mengubah artikel Knowledge Base.</p>
            <div className="mt-4">
              <Button type="button" variant="ghost" onClick={() => router.push("/knowledge")}>
                Kembali ke Knowledge Base
              </Button>
            </div>
          </Card>
        ) : (
          <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <Link href="/knowledge" className="text-sm text-zinc-500 hover:text-zinc-300">
              {"<"} Kembali ke Knowledge Base
            </Link>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Tulis artikel knowledge baru</h2>
            <p className="mt-1 text-sm text-zinc-400">Susun artikel markdown lengkap beserta metadata. Artikel baru akan tersimpan sebagai non-aktif sampai diaktifkan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">Non Active</Badge>
            <Badge tone="blue">Third-Party Editor</Badge>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]"
        >
          <Card className="self-start overflow-hidden border-ink-500/60 bg-ink-800/75 !p-0">
            <div className="border-b border-ink-700 px-5 py-4">
              <Label htmlFor="title">Judul Artikel</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Prosedur reset password customer" />
            </div>
            <div className="px-5 py-5">
              <Label htmlFor="content">Isi Artikel Markdown</Label>
              <p className="mb-3 text-xs text-zinc-500">Editor menggunakan library pihak ketiga `@uiw/react-md-editor`. Gunakan mode split untuk menulis sambil melihat preview secara bersamaan.</p>
              <MarkdownEditor
                id="content"
                required
                rows={18}
                value={content}
                minLength={20}
                wikilinkTargets={wikilinkTargets.data?.items ?? []}
                placeholder={`# Judul artikel

Ringkas konteks artikel di awal.

## Langkah
- Tulis poin penting
- Tambahkan contoh

## Catatan
Tuliskan edge case atau pengecualian di sini.`}
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
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Ringkasan singkat artikel untuk reviewer dan daftar knowledge."
                  />
                </div>
                <div>
                  <Label htmlFor="category">Kategori</Label>
                  <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
                  <Select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                    <option value="PUBLIC">PUBLIC (dapat dibaca AI customer)</option>
                    <option value="AGENT_ONLY">AGENT_ONLY (khusus agent)</option>
                    <option value="INTERNAL">INTERNAL</option>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="effectiveDate">Aktif Mulai</Label>
                    <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="expiredDate">Berakhir Pada</Label>
                    <Input id="expiredDate" type="date" value={expiredDate} onChange={(e) => setExpiredDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-ink-500/60 bg-ink-800/75">
              <CardHeader>
                <CardTitle>Status Knowledge</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm text-zinc-400">
                <p>Pastikan artikel punya judul spesifik, ringkasan singkat, dan heading yang jelas agar mudah dipakai ulang oleh tim dan AI.</p>
                <p>Artikel baru akan dibuat sebagai <strong className="text-zinc-200">NON_ACTIVE</strong>. Aktifkan dari halaman detail jika sudah siap dipakai AI.</p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="submit" disabled={create.isPending}>
                  Simpan sebagai Non Active
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push("/knowledge")}>
                  Batal
                </Button>
              </div>
            </Card>
          </div>
        </form>
          </>
        )}
      </main>
    </>
  );
}
