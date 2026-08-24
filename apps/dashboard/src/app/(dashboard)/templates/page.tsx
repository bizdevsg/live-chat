"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface Template {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  language: string;
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const query = useQuery({ queryKey: ["templates"], queryFn: () => apiClient.get<Template[]>("/api/v1/admin/templates") });
  const templates = query.data ?? [];
  const languages = new Set(templates.map((template) => template.language)).size;
  const averageLength = templates.length > 0 ? Math.round(templates.reduce((total, template) => total + template.content.length, 0) / templates.length) : 0;

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/templates", { shortcut, title, content }),
    onSuccess: () => {
      toast.push("Template dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setOpen(false);
      setShortcut("");
      setTitle("");
      setContent("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat template.", "error"),
  });

  const update = useMutation({
    mutationFn: () => apiClient.put(`/api/v1/admin/templates/${editTarget!.id}`, { title, content }),
    onSuccess: () => {
      toast.push("Template diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setEditTarget(null);
      setShortcut("");
      setTitle("");
      setContent("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui template.", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/admin/templates/${id}`),
    onSuccess: () => {
      toast.push("Template dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus template.", "error"),
  });

  const resetForm = () => {
    setShortcut("");
    setTitle("");
    setContent("");
  };

  return (
    <>
      <Topbar title="Response Templates" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Response templates"
            description="Koleksi template diperbarui agar shortcut, bahasa, dan isi balasan cepat terbaca seperti pustaka operasional yang siap pakai."
            actions={<Button onClick={() => setOpen(true)}>+ Template Baru</Button>}
          />
          <DashboardPageMetrics
            items={[
              { label: "Template", value: String(templates.length), detail: "Jumlah template aktif yang tersedia untuk agent." },
              { label: "Bahasa", value: String(languages), detail: "Bahasa berbeda yang dipakai pada library template." },
              { label: "Avg content", value: `${averageLength} char`, detail: "Rata-rata panjang isi template per entri." },
              { label: "Shortcut", value: String(templates.length), detail: "Setiap template memiliki shortcut unik untuk pemanggilan cepat." },
            ]}
          />
          <DashboardTablePanel title="Template library" detail="Semua template disusun sebagai koleksi kartu agar agent bisa cepat mengenali shortcut dan konteks balasannya.">
            <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 md:px-6 md:py-6">
              {templates.map((template) => (
                <section key={template.id} className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-gold-500">/{template.shortcut}</span>
                    <span className="text-xs uppercase tracking-[0.24em] text-zinc-600">{template.language}</span>
                  </div>
                  <p className="mb-2 text-sm font-medium text-zinc-200">{template.title}</p>
                  <p className="text-sm leading-6 text-zinc-500">{template.content}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditTarget(template);
                        setShortcut(template.shortcut);
                        setTitle(template.title);
                        setContent(template.content);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(template)}>
                      Hapus
                    </Button>
                  </div>
                </section>
              ))}
              {!query.isLoading && templates.length === 0 ? <DashboardEmpty>Belum ada template yang dibuat.</DashboardEmpty> : null}
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

      <Modal
        open={open}
        title="Template Baru"
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="shortcut">Shortcut</Label>
            <Input id="shortcut" required placeholder="salam-pembuka" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="title">Judul</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="content">Isi</Label>
            <Textarea id="content" required value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editTarget}
        title={`Edit Template${editTarget ? `: /${editTarget.shortcut}` : ""}`}
        onClose={() => {
          setEditTarget(null);
          resetForm();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="edit-shortcut">Shortcut</Label>
            <Input id="edit-shortcut" value={shortcut} disabled />
          </div>
          <div>
            <Label htmlFor="edit-title">Judul</Label>
            <Input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-content">Isi</Label>
            <Textarea id="edit-content" required value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Template"
        description={`Template ${deleteTarget ? `/${deleteTarget.shortcut}` : ""} akan dihapus permanen.`}
        confirmLabel={remove.isPending ? "Menghapus..." : "Hapus"}
        danger
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
