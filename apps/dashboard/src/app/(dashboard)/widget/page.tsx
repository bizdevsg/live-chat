"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Site {
  id: string;
  siteKey: string;
  name: string;
  aiName: string;
  greeting: string;
  widgetColor: string;
  domains: Array<{ id: string; domain: string }>;
  settings: {
    widgetEnabled: boolean;
    aiEnabled: boolean;
    humanChatEnabled: boolean;
    showAgentButton: boolean;
    allowAttachments: boolean;
    ratingFormEnabled: boolean;
  } | null;
}

const WIDGET_ORIGIN = process.env.NEXT_PUBLIC_WIDGET_URL ?? "http://localhost:3001";

export default function WidgetSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: () => apiClient.get<Site[]>("/api/v1/admin/sites") });
  const site = sitesQuery.data?.[0];
  const [newDomain, setNewDomain] = useState("");
  const [settings, setSettings] = useState<Site["settings"] | null>(null);

  useEffect(() => {
    if (site?.settings) setSettings(site.settings);
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

  const embedScript = `<script\n  src="${WIDGET_ORIGIN}/widget.js"\n  data-site-id="${site.siteKey}"\n  data-position="bottom-right"\n  data-language="id"\n  async>\n</script>`;

  return (
    <>
      <Topbar title="Widget Settings" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Script Pemasangan</CardTitle>
          </CardHeader>
          <p className="mb-2 text-xs text-zinc-500">Tempelkan snippet ini sebelum tag &lt;/body&gt; di website Solid Gold.</p>
          <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-emerald-400">{embedScript}</pre>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domain yang Diizinkan</CardTitle>
          </CardHeader>
          <ul className="mb-3 space-y-1">
            {site.domains.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2 text-sm text-zinc-300">
                {d.domain}
                <button className="text-xs text-red-400 hover:underline" onClick={() => removeDomain.mutate(d.id)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="sg-berjangka.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
            <Button variant="secondary" onClick={() => addDomain.mutate()} disabled={!newDomain}>
              Tambah
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perilaku Widget</CardTitle>
          </CardHeader>
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
              <label key={key} className="flex items-center gap-2 text-sm text-zinc-300">
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
        </Card>
      </main>
    </>
  );
}
