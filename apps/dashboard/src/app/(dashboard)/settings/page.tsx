"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface Site {
  id: string;
  siteKey: string;
  name: string;
  language: string;
  timezone: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const query = useQuery({ queryKey: ["sites"], queryFn: () => apiClient.get<Site[]>("/api/v1/admin/sites") });

  return (
    <>
      <Topbar title="System Settings" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Sites Terdaftar</CardTitle>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2">Site ID</th>
                <th className="py-2">Nama</th>
                <th className="py-2">Bahasa</th>
                <th className="py-2">Timezone</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((s) => (
                <tr key={s.id} className="border-t border-ink-700">
                  <td className="py-2 font-mono text-xs">{s.siteKey}</td>
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 text-zinc-400">{s.language}</td>
                  <td className="py-2 text-zinc-400">{s.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-zinc-600">
          Pengaturan widget per-site tersedia di halaman Widget Settings. Konfigurasi AI tersedia di halaman AI Configuration.
        </p>
      </main>
    </>
  );
}
