"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
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
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const query = useQuery({ queryKey: ["templates"], queryFn: () => apiClient.get<Template[]>("/api/v1/admin/templates") });
  const templates = query.data ?? [];
  const languages = new Set(templates.map((template) => template.language)).size;
  const averageLength = templates.length > 0 ? Math.round(templates.reduce((total, template) => total + template.content.length, 0) / templates.length) : 0;

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/admin/templates/${id}`),
    onSuccess: () => {
      toast.push("Template dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus template.", "error"),
  });

  return (
    <>
      <Topbar title="Response Templates" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Response templates"
            description="Pustaka balasan cepat lengkap dengan shortcut dan bahasa, siap dipakai agent."
            actions={
              <Link href="/templates/new">
                <Button>+ Template Baru</Button>
              </Link>
            }
          />
          <DashboardPageMetrics
            items={[
              { label: "Template", value: String(templates.length), detail: "Jumlah template aktif yang tersedia untuk agent." },
              { label: "Bahasa", value: String(languages), detail: "Bahasa berbeda yang dipakai pada library template." },
              { label: "Avg content", value: `${averageLength} char`, detail: "Rata-rata panjang isi template per entri." },
              { label: "Shortcut", value: String(templates.length), detail: "Setiap template memiliki shortcut unik untuk pemanggilan cepat." },
            ]}
          />
          <DashboardTablePanel title="Template library" detail="Kenali shortcut dan konteks balasan dengan cepat.">
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
              {templates.map((template) => (
                <section key={template.id} className="flex flex-col rounded-xl border border-ink-600 bg-ink-900/60 p-4 transition-colors hover:border-ink-500">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-md bg-gold-500/10 px-2 py-0.5 font-mono text-xs text-gold-300">/{template.shortcut}</span>
                    <Badge>{template.language.toUpperCase()}</Badge>
                  </div>
                  <p className="mb-1.5 text-sm font-medium text-zinc-100">{template.title}</p>
                  <p className="line-clamp-4 flex-1 text-sm leading-6 text-zinc-500">{template.content}</p>
                  <div className="mt-4 flex gap-1.5 border-t border-ink-600 pt-3">
                    <Link href={`/templates/${template.id}/edit`}>
                      <Button size="sm" variant="ghost">
                        Edit
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setDeleteTarget(template)}>
                      Hapus
                    </Button>
                  </div>
                </section>
              ))}
              {!query.isLoading && templates.length === 0 ? (
                <div className="col-span-full">
                  <DashboardEmpty>Belum ada template yang dibuat.</DashboardEmpty>
                </div>
              ) : null}
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

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
