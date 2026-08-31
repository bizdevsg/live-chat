"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmModal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";

interface Category {
  id: string;
  name: string;
}

interface KnowledgeDoc {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  audience: string;
  version: number;
  updatedAt: string;
  category?: Category | null;
}

const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "amber" | "blue"> = {
  ACTIVE: "green",
  NON_ACTIVE: "neutral",
};

export default function KnowledgePage() {
  const [status, setStatus] = useState("");
  const [audience, setAudience] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingDoc, setDeletingDoc] = useState<KnowledgeDoc | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const isSuperAdmin = isSuperAdminRole(user?.roles);

  const categories = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: () => apiClient.get<Category[]>("/api/v1/knowledge/categories"),
  });

  const overview = useQuery({
    queryKey: ["knowledge-overview"],
    queryFn: () => apiClient.get<{ items: KnowledgeDoc[] }>("/api/v1/knowledge/documents?pageSize=200"),
  });

  const query = useQuery({
    queryKey: ["knowledge", status, audience, categoryId, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (audience) params.set("audience", audience);
      if (categoryId) params.set("categoryId", categoryId);
      if (search.trim()) params.set("search", search.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiClient.get<{ items: KnowledgeDoc[] }>(`/api/v1/knowledge/documents${suffix}`);
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.upload("/api/v1/knowledge/upload", formData);
    },
    onSuccess: () => {
      toast.push("Dokumen markdown berhasil diunggah sebagai NON_ACTIVE.", "success");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mengunggah dokumen.", "error"),
  });

  const removeArticle = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ id: string }>(`/api/v1/knowledge/documents/${id}`),
    onSuccess: () => {
      toast.push("Artikel dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-overview"] });
      setDeletingDoc(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus artikel.", "error"),
  });
  const toggleStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: "ACTIVE" | "NON_ACTIVE" }) =>
      apiClient.post(
        `/api/v1/knowledge/documents/${id}/${nextStatus === "ACTIVE" ? "activate" : "deactivate"}`,
      ),
    onMutate: ({ id }) => {
      setPendingToggleId(id);
    },
    onSuccess: (_, variables) => {
      toast.push(
        variables.nextStatus === "ACTIVE" ? "Artikel diaktifkan untuk AI." : "Artikel dinonaktifkan dari AI.",
        "success",
      );
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-overview"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mengubah status artikel.", "error"),
    onSettled: () => {
      setPendingToggleId(null);
    },
  });

  const docs = query.data?.items ?? [];
  const overviewItems = overview.data?.items ?? [];
  const stats = {
    total: overviewItems.length,
    active: overviewItems.filter((item) => item.status === "ACTIVE").length,
    nonActive: overviewItems.filter((item) => item.status === "NON_ACTIVE").length,
  };
  const activeFilterCount = [status, audience, categoryId, search.trim()].filter(Boolean).length;

  return (
    <>
      <Topbar title="Knowledge Base" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 xl:p-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && !file.name.toLowerCase().endsWith(".md")) {
              toast.push("Knowledge hanya menerima file Markdown (.md).", "error");
            } else if (file) {
              upload.mutate(file);
            }
            e.target.value = "";
          }}
        />

        <Card className="mb-6 overflow-hidden border-gold-500/15 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.16),transparent_34%),linear-gradient(180deg,rgba(33,33,37,0.96),rgba(17,17,20,0.98))] p-0">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.3fr)_auto] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="gold">Markdown Only</Badge>
                <Badge tone="blue">Simple Status</Badge>
                <Badge tone="green">AI Retrieval Ready</Badge>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Knowledge Base yang lebih siap dipakai harian</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                Kelola artikel markdown dengan status sederhana: aktif atau non-aktif. Hanya Super Admin yang dapat mengubah isi Knowledge Base.
              </p>
            </div>
            {isSuperAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
                  Upload Markdown
                </Button>
                <Link href="/knowledge/new">
                  <Button>+ Artikel Baru</Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-ink-600 bg-ink-900/50 px-4 py-3 text-sm text-zinc-400">
                Mode baca saja. Perubahan KB hanya untuk Super Admin.
              </div>
            )}
          </div>
        </Card>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-ink-500/60 bg-ink-800/75">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Total Artikel</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{stats.total}</p>
            <p className="mt-2 text-sm text-zinc-400">Seluruh artikel knowledge yang tersedia di site ini.</p>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300/80">Active</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{stats.active}</p>
            <p className="mt-2 text-sm text-zinc-400">Artikel aktif yang dipakai untuk knowledge retrieval AI.</p>
          </Card>
          <Card className="border-ink-500/60 bg-ink-800/75">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Non Active</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{stats.nonActive}</p>
            <p className="mt-2 text-sm text-zinc-400">Artikel tersimpan tetapi belum dipakai AI customer.</p>
          </Card>
          <Card className="border-gold-500/20 bg-gold-500/5">
            <p className="text-xs uppercase tracking-[0.22em] text-gold-500/80">Access</p>
            <p className="mt-3 text-xl font-semibold text-zinc-50">{isSuperAdmin ? "Super Admin" : "Read Only"}</p>
            <p className="mt-2 text-sm text-zinc-400">Perubahan Knowledge Base dibatasi khusus untuk role Super Admin.</p>
          </Card>
        </section>

        <Card className="mb-6 border-ink-500/60 bg-ink-800/75">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Filter dan Pencarian</h3>
              <p className="mt-1 text-sm text-zinc-400">Cari artikel berdasarkan konten, lalu saring dengan status, audience, dan kategori.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{docs.length} artikel tampil</span>
              {activeFilterCount > 0 && <span>{activeFilterCount} filter aktif</span>}
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,180px))]">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Cari Artikel</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, ringkasan, atau isi markdown..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Semua status</option>
                {["ACTIVE", "NON_ACTIVE"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Audience</label>
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="">Semua audience</option>
                <option value="PUBLIC">PUBLIC</option>
                <option value="AGENT_ONLY">AGENT_ONLY</option>
                <option value="INTERNAL">INTERNAL</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Kategori</label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Semua kategori</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        <Card className="mb-4 text-sm text-zinc-400">
          Knowledge disimpan sebagai Markdown. Upload file dibatasi ke <code className="rounded bg-ink-900 px-1.5 py-0.5 text-zinc-200">.md</code>, dan hanya artikel berstatus <code className="rounded bg-ink-900 px-1.5 py-0.5 text-zinc-200">ACTIVE</code> yang dipakai untuk retrieval AI.
        </Card>

        <Card className="overflow-hidden !p-0">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Daftar Artikel</h3>
              <p className="mt-1 text-sm text-zinc-500">Ringkasan, kategori, audience, dan status review dalam satu tabel kerja.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus("");
                setAudience("");
                setCategoryId("");
                setSearch("");
              }}
            >
              Reset Filter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Artikel</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Versi</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Diperbarui</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-t border-ink-700 hover:bg-ink-700/30">
                    <td className="px-4 py-4">
                      <Link href={`/knowledge/${doc.id}`} className="text-sm font-medium text-zinc-100 hover:text-gold-500">
                        {doc.title}
                      </Link>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-500">
                        {doc.summary?.trim() || "Belum ada ringkasan. Buka artikel untuk melengkapi konteks konten."}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{doc.category?.name ?? "Tanpa kategori"}</td>
                    <td className="px-4 py-4 text-zinc-400">{doc.audience}</td>
                    <td className="px-4 py-4 text-zinc-400">v{doc.version}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status}</Badge>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={doc.status === "ACTIVE"}
                            aria-label={doc.status === "ACTIVE" ? `Nonaktifkan ${doc.title}` : `Aktifkan ${doc.title}`}
                            onClick={() =>
                              toggleStatus.mutate({
                                id: doc.id,
                                nextStatus: doc.status === "ACTIVE" ? "NON_ACTIVE" : "ACTIVE",
                              })
                            }
                            disabled={pendingToggleId === doc.id || removeArticle.isPending}
                            className={cn(
                              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
                              doc.status === "ACTIVE"
                                ? "border-emerald-400/40 bg-emerald-500"
                                : "border-ink-500 bg-zinc-600",
                              pendingToggleId === doc.id || removeArticle.isPending ? "cursor-wait opacity-60" : "cursor-pointer",
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                                doc.status === "ACTIVE" ? "translate-x-6" : "translate-x-1",
                              )}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-500">{new Date(doc.updatedAt).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/knowledge/${doc.id}`}>
                          <Button variant="ghost" size="sm">
                            {isSuperAdmin ? "Lihat/Edit" : "Lihat"}
                          </Button>
                        </Link>
                        {isSuperAdmin && (
                          <Button variant="danger" size="sm" onClick={() => setDeletingDoc(doc)} disabled={removeArticle.isPending}>
                            Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-md">
                        <p className="text-base font-medium text-zinc-200">Belum ada artikel yang cocok dengan filter saat ini.</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">Coba reset filter atau tambahkan artikel markdown baru agar knowledge siap dipakai tim dan AI.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
      <ConfirmModal
        open={Boolean(deletingDoc)}
        title="Hapus artikel knowledge?"
        description={deletingDoc ? `Artikel "${deletingDoc.title}" akan dihapus permanen bersama source markdown dan chunk index-nya.` : ""}
        confirmLabel={removeArticle.isPending ? "Menghapus..." : "Hapus Permanen"}
        danger
        onConfirm={() => {
          if (deletingDoc) removeArticle.mutate(deletingDoc.id);
        }}
        onClose={() => {
          if (!removeArticle.isPending) setDeletingDoc(null);
        }}
      />
    </>
  );
}
