"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface Integration {
  id: string;
  type: string;
  provider: string;
  name: string;
  isActive: boolean;
  config: Record<string, unknown> | null;
  logs: Array<{ id: string; action: string; status: string; createdAt: string }>;
}

type IntegrationForm = {
  type: string;
  provider: string;
  name: string;
  configJson: string;
  isActive: boolean;
};

const DEFAULT_FORM: IntegrationForm = {
  type: "CRM",
  provider: "mock",
  name: "",
  configJson: "{}",
  isActive: true,
};

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [deleting, setDeleting] = useState<Integration | null>(null);
  const [form, setForm] = useState<IntegrationForm>(DEFAULT_FORM);
  const query = useQuery({ queryKey: ["integrations"], queryFn: () => apiClient.get<Integration[]>("/api/v1/admin/integrations") });
  const integrations = query.data ?? [];
  const activeIntegrations = integrations.filter((integration) => integration.isActive).length;
  const failingLogs = integrations.flatMap((integration) => integration.logs).filter((log) => log.status !== "SUCCESS").length;
  const providers = new Set(integrations.map((integration) => integration.provider)).size;

  const parseConfig = () => {
    try {
      return JSON.parse(form.configJson || "{}") as Record<string, unknown>;
    } catch {
      throw new Error("Config harus berupa JSON yang valid.");
    }
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["integrations"] });

  const create = useMutation({
    mutationFn: async () =>
      apiClient.post("/api/v1/admin/integrations", {
        type: form.type,
        provider: form.provider,
        name: form.name,
        config: parseConfig(),
        isActive: form.isActive,
      }),
    onSuccess: () => {
      toast.push("Integrasi berhasil dibuat.", "success");
      invalidate();
      setOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (err) => toast.push(err instanceof Error ? err.message : "Gagal membuat integrasi.", "error"),
  });

  const update = useMutation({
    mutationFn: async () =>
      apiClient.put(`/api/v1/admin/integrations/${editing!.id}`, {
        type: form.type,
        provider: form.provider,
        name: form.name,
        config: parseConfig(),
        isActive: form.isActive,
      }),
    onSuccess: () => {
      toast.push("Integrasi berhasil diperbarui.", "success");
      invalidate();
      setEditing(null);
      setForm(DEFAULT_FORM);
    },
    onError: (err) => toast.push(err instanceof Error ? err.message : "Gagal memperbarui integrasi.", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/admin/integrations/${id}`),
    onSuccess: () => {
      toast.push("Integrasi berhasil dihapus.", "success");
      invalidate();
      setDeleting(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus integrasi.", "error"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.put(`/api/v1/admin/integrations/${id}`, { isActive }),
    onSuccess: () => {
      toast.push("Status integrasi diperbarui.", "success");
      invalidate();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui status integrasi.", "error"),
  });

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
  };

  return (
    <>
      <Topbar title="Integrations" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Integrations"
            description="Kartu integrasi diperjelas agar status provider, konfigurasi JSON, dan jejak log operasional bisa dibaca sebagai control room yang lebih rapi."
            actions={
              <Button
                onClick={() => {
                  setEditing(null);
                  setForm(DEFAULT_FORM);
                  setOpen(true);
                }}
              >
                + Integrasi Baru
              </Button>
            }
          />
          <DashboardPageMetrics
            items={[
              { label: "Integrasi", value: String(integrations.length), detail: "Seluruh koneksi sistem yang sudah dibuat." },
              { label: "Aktif", value: String(activeIntegrations), detail: "Integrasi yang sedang berjalan saat ini." },
              { label: "Provider", value: String(providers), detail: "Jumlah provider berbeda yang digunakan." },
              { label: "Log gagal", value: String(failingLogs), detail: "Indikator error dari log terbaru semua integrasi." },
            ]}
          />
          <DashboardTablePanel title="Integration control room" detail="Semua integrasi disusun sebagai kartu operasional dengan status, konfigurasi, dan aktivitas terbaru.">
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2 md:px-6 md:py-6 xl:grid-cols-3">
        {integrations.map((integration) => (
          <section
            key={integration.id}
            className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {integration.name} ({integration.type})
                </h3>
                <p className="mt-2 text-xs uppercase tracking-[0.28em] text-zinc-500">{integration.provider}</p>
              </div>
              <Badge tone={integration.isActive ? "green" : "neutral"}>{integration.isActive ? "Aktif" : "Nonaktif"}</Badge>
            </div>
            <pre className="scrollbar-thin mt-4 overflow-x-auto rounded-2xl border border-ink-600 bg-ink-900 p-3 text-xs text-zinc-400">
              {JSON.stringify(integration.config ?? {}, null, 2)}
            </pre>
            <p className="mb-2 mt-4 text-xs uppercase tracking-[0.24em] text-zinc-500">Log terakhir</p>
            <ul className="space-y-2 text-xs text-zinc-500">
              {integration.logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-900/70 px-3 py-2">
                  <span>{log.action}</span>
                  <Badge tone={log.status === "SUCCESS" ? "green" : "red"}>{log.status}</Badge>
                </li>
              ))}
              {integration.logs.length === 0 ? <li>Belum ada aktivitas.</li> : null}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(integration);
                  setForm({
                    type: integration.type,
                    provider: integration.provider,
                    name: integration.name,
                    configJson: JSON.stringify(integration.config ?? {}, null, 2),
                    isActive: integration.isActive,
                  });
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggleActive.mutate({ id: integration.id, isActive: !integration.isActive })}
              >
                {integration.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleting(integration)}>
                Hapus
              </Button>
            </div>
          </section>
        ))}

        {!query.isLoading && integrations.length === 0 ? <DashboardEmpty>Belum ada integrasi terkonfigurasi.</DashboardEmpty> : null}
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

      <Modal
        open={open || !!editing}
        title={editing ? `Edit Integrasi: ${editing.name}` : "Integrasi Baru"}
        onClose={closeModal}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) {
              update.mutate();
              return;
            }
            create.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="integration-type">Type</Label>
              <Select id="integration-type" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="CRM">CRM</option>
                <option value="EMAIL">EMAIL</option>
                <option value="WEBHOOK">WEBHOOK</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="integration-provider">Provider</Label>
              <Input id="integration-provider" value={form.provider} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="integration-name">Nama</Label>
            <Input id="integration-name" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="integration-config">Config JSON</Label>
            <Textarea
              id="integration-config"
              value={form.configJson}
              onChange={(e) => setForm((prev) => ({ ...prev, configJson: e.target.value }))}
              className="min-h-[160px] font-mono text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded accent-gold-500"
            />
            Integrasi aktif
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editing ? "Simpan Perubahan" : "Buat Integrasi"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Hapus Integrasi"
        description={`Integrasi "${deleting?.name ?? ""}" akan dihapus permanen.`}
        confirmLabel={remove.isPending ? "Menghapus..." : "Hapus"}
        danger
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
