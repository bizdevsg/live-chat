"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface Site {
  id: string;
  siteKey: string;
  name: string;
  aiName: string;
  greeting: string;
  offlineMessage: string;
  language: string;
  timezone: string;
  widgetColor: string;
  isActive: boolean;
}

type SiteForm = {
  siteKey: string;
  name: string;
  aiName: string;
  language: string;
  widgetColor: string;
  greeting: string;
  offlineMessage: string;
};

const DEFAULT_FORM: SiteForm = {
  siteKey: "",
  name: "",
  aiName: "Asisten Virtual",
  language: "id",
  widgetColor: "#D4AF37",
  greeting: "Halo! Ada yang bisa kami bantu?",
  offlineMessage: "Tim kami sedang di luar jam operasional.",
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [form, setForm] = useState<SiteForm>(DEFAULT_FORM);
  const query = useQuery({ queryKey: ["sites"], queryFn: () => apiClient.get<Site[]>("/api/v1/admin/sites") });
  const sites = query.data ?? [];
  const activeSites = sites.filter((site) => site.isActive).length;
  const languages = new Set(sites.map((site) => site.language)).size;
  const timezones = new Set(sites.map((site) => site.timezone)).size;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sites"] });

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/sites", form),
    onSuccess: () => {
      toast.push("Site berhasil dibuat.", "success");
      invalidate();
      setOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat site.", "error"),
  });

  const update = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/admin/sites/${editingSite!.id}`, {
        name: form.name,
        aiName: form.aiName,
        language: form.language,
        widgetColor: form.widgetColor,
        greeting: form.greeting,
        offlineMessage: form.offlineMessage,
      }),
    onSuccess: () => {
      toast.push("Site berhasil diperbarui.", "success");
      invalidate();
      setEditingSite(null);
      setForm(DEFAULT_FORM);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui site.", "error"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.put(`/api/v1/admin/sites/${id}`, { isActive }),
    onSuccess: () => {
      toast.push("Status site diperbarui.", "success");
      invalidate();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui status site.", "error"),
  });

  const openCreate = () => {
    setEditingSite(null);
    setForm(DEFAULT_FORM);
    setOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditingSite(site);
    setForm({
      siteKey: site.siteKey,
      name: site.name,
      aiName: site.aiName,
      language: site.language,
      widgetColor: site.widgetColor,
      greeting: site.greeting,
      offlineMessage: site.offlineMessage,
    });
  };

  const closeModal = () => {
    setOpen(false);
    setEditingSite(null);
    setForm(DEFAULT_FORM);
  };

  return (
    <>
      <Topbar title="System Settings" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="System settings"
            description="Konfigurasi master site kini dikemas sebagai pusat kendali operasional untuk workspace, bahasa, dan identitas widget di seluruh deployment."
            actions={<Button onClick={openCreate}>+ Site Baru</Button>}
          />
          <DashboardPageMetrics
            items={[
              { label: "Site terdaftar", value: String(sites.length), detail: "Seluruh site yang aktif maupun nonaktif." },
              { label: "Site aktif", value: String(activeSites), detail: "Site yang saat ini dilayani oleh sistem." },
              { label: "Bahasa", value: String(languages), detail: "Jumlah varian bahasa yang dipakai oleh seluruh site." },
              { label: "Timezone", value: String(timezones), detail: "Distribusi timezone yang aktif di konfigurasi site." },
            ]}
          />
          <DashboardTablePanel title="Registered sites" detail="Halaman ini dipakai untuk konfigurasi master site. Preferensi personal admin tetap berada di Profile / Account Settings.">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              <tr>
                <th className="px-5 py-4">Site ID</th>
                <th className="px-5 py-4">Nama</th>
                <th className="px-5 py-4">AI Name</th>
                <th className="px-5 py-4">Bahasa</th>
                <th className="px-5 py-4">Timezone</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/80">
              {sites.map((site) => (
                <tr key={site.id} className="transition-colors hover:bg-ink-700/35">
                  <td className="px-5 py-4 font-mono text-xs text-zinc-400">{site.siteKey}</td>
                  <td className="px-5 py-4 font-medium text-zinc-100">{site.name}</td>
                  <td className="px-5 py-4 text-zinc-400">{site.aiName}</td>
                  <td className="px-5 py-4 text-zinc-400">{site.language}</td>
                  <td className="px-5 py-4 text-zinc-400">{site.timezone}</td>
                  <td className="px-5 py-4">
                    <Badge tone={site.isActive ? "green" : "neutral"}>{site.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(site)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate({ id: site.id, isActive: !site.isActive })}>
                        {site.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!query.isLoading && sites.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <DashboardEmpty>Belum ada site yang terdaftar.</DashboardEmpty>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </DashboardTablePanel>
        </div>
      </DashboardPage>

      <Modal
        open={open || !!editingSite}
        title={editingSite ? `Edit Site: ${editingSite.name}` : "Site Baru"}
        onClose={closeModal}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editingSite) {
              update.mutate();
              return;
            }
            create.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="siteKey">Site Key</Label>
              <Input
                id="siteKey"
                required
                value={form.siteKey}
                disabled={!!editingSite}
                onChange={(e) => setForm((prev) => ({ ...prev, siteKey: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="siteName">Nama Site</Label>
              <Input id="siteName" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aiName">AI Name</Label>
              <Input id="aiName" value={form.aiName} onChange={(e) => setForm((prev) => ({ ...prev, aiName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="language">Bahasa</Label>
              <Input id="language" value={form.language} onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="widgetColor">Warna Widget</Label>
            <Input id="widgetColor" value={form.widgetColor} onChange={(e) => setForm((prev) => ({ ...prev, widgetColor: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="greeting">Greeting</Label>
            <Textarea id="greeting" value={form.greeting} onChange={(e) => setForm((prev) => ({ ...prev, greeting: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="offlineMessage">Offline Message</Label>
            <Textarea
              id="offlineMessage"
              value={form.offlineMessage}
              onChange={(e) => setForm((prev) => ({ ...prev, offlineMessage: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editingSite ? "Simpan Perubahan" : "Buat Site"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
