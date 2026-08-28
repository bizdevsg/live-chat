"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

type WidgetSettingsForm = {
  widgetEnabled: boolean;
  aiEnabled: boolean;
  humanChatEnabled: boolean;
  showAgentButton: boolean;
  allowAttachments: boolean;
  ratingFormEnabled: boolean;
};

type WidgetSettingsResponse = WidgetSettingsForm & {
  id: string;
  siteId: string;
  updatedAt: string;
};

interface Site {
  id: string;
  siteKey: string;
  name: string;
  aiName: string;
  greeting: string;
  widgetColor: string;
  domains: Array<{ id: string; domain: string }>;
  settings: WidgetSettingsResponse | null;
}

function toWidgetSettingsForm(settings: WidgetSettingsResponse): WidgetSettingsForm {
  return {
    widgetEnabled: settings.widgetEnabled,
    aiEnabled: settings.aiEnabled,
    humanChatEnabled: settings.humanChatEnabled,
    showAgentButton: settings.showAgentButton,
    allowAttachments: settings.allowAttachments,
    ratingFormEnabled: settings.ratingFormEnabled,
  };
}

const WIDGET_ORIGIN = process.env.NEXT_PUBLIC_WIDGET_URL ?? "http://localhost:3001";
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function WidgetSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: () => apiClient.get<Site[]>("/api/v1/admin/sites") });
  const site = sitesQuery.data?.[0];
  const [newDomain, setNewDomain] = useState("");
  const [settings, setSettings] = useState<WidgetSettingsForm | null>(null);

  useEffect(() => {
    if (site?.settings) setSettings(toWidgetSettingsForm(site.settings));
  }, [site]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sites"] });

  const saveSettings = useMutation({
    mutationFn: () => apiClient.put(`/api/v1/admin/sites/${site!.id}/widget-settings`, settings),
    onSuccess: () => {
      toast.push("Pengaturan widget disimpan.", "success");
      invalidate();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error"),
  });

  const addDomain = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/admin/sites/${site!.id}/domains`, { domain: newDomain }),
    onSuccess: () => {
      setNewDomain("");
      invalidate();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menambah domain.", "error"),
  });

  const removeDomain = useMutation({
    mutationFn: (domainId: string) => apiClient.delete(`/api/v1/admin/sites/domains/${domainId}`),
    onSuccess: invalidate,
  });

  if (!site || !settings) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat…</div>;

  const embedScript = `<script\n  src="${WIDGET_ORIGIN}/widget.js"\n  data-site-id="${site.siteKey}"\n  data-api-url="${API_ORIGIN}"\n  data-position="bottom-right"\n  data-language="id"\n  async>\n</script>`;

  return (
    <>
      <Topbar title="Widget Settings" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Widget settings"
            description="Area widget kini dibagi menjadi tiga surface utama: pemasangan script, domain governance, dan perilaku experience di sisi user."
          />
          <DashboardPageMetrics
            items={[
              { label: "Site", value: site.name, detail: `Konfigurasi aktif untuk ${site.siteKey}.` },
              { label: "Domain", value: String(site.domains.length), detail: "Jumlah domain yang diizinkan memuat widget." },
              { label: "Widget", value: settings.widgetEnabled ? "Aktif" : "Off", detail: "Status master untuk tampilan widget." },
              { label: "Attachment", value: settings.allowAttachments ? "On" : "Off", detail: "Izin upload file dari percakapan pelanggan." },
            ]}
          />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <DashboardTablePanel title="Script pemasangan" detail="Gunakan snippet ini untuk menyematkan widget ke website tujuan.">
          <div className="px-5 py-5 md:px-6 md:py-6">
          <p className="mb-2 text-xs text-zinc-500">Tempelkan snippet ini sebelum tag &lt;/body&gt; di website Solid Gold.</p>
          <pre className="scrollbar-thin overflow-x-auto rounded-2xl border border-ink-600 bg-ink-900 p-4 text-xs text-emerald-400">{embedScript}</pre>
          </div>
        </DashboardTablePanel>

        <DashboardTablePanel title="Domain governance" detail="Kelola origin yang berhak memuat widget agar distribusi tetap aman dan terkontrol.">
          <div className="px-5 py-5 md:px-6 md:py-6">
          <ul className="mb-3 space-y-1">
            {site.domains.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-2xl border border-ink-600 bg-ink-900/70 px-3 py-3 text-sm text-zinc-300">
                {d.domain}
                <button className="text-xs text-red-400 hover:underline" onClick={() => removeDomain.mutate(d.id)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="sg-berjangka.com atau https://domain.com/path" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
              <Button variant="secondary" onClick={() => addDomain.mutate()} disabled={!newDomain}>
                Tambah
              </Button>
            </div>
          </div>
        </DashboardTablePanel>
          </div>

        <DashboardTablePanel title="Perilaku widget" detail="Atur bagaimana widget AI dan human handoff berperilaku di sisi pengunjung website.">
          <div className="px-5 py-5 md:px-6 md:py-6">
          <div className="space-y-2">
            {(
              [
                ["widgetEnabled", "Widget aktif"],
                ["aiEnabled", "AI aktif"],
                ["humanChatEnabled", "Human chat aktif"],
                ["showAgentButton", "Tampilkan tombol \"Bicara dengan CS\""],
                ["allowAttachments", "Izinkan lampiran file"],
                ["ratingFormEnabled", "Tampilkan form rating"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800/70 px-4 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  className="h-4 w-4 rounded accent-gold-500"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              Simpan
            </Button>
          </div>
          </div>
        </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
