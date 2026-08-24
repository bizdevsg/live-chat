"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import {
  DashboardEmpty,
  DashboardPage,
  DashboardPageHeader,
  DashboardPageMetrics,
  DashboardTablePanel,
} from "@/components/layout/dashboard-page";

interface AuditLog {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const query = useQuery({ queryKey: ["audit-logs"], queryFn: () => apiClient.get<{ items: AuditLog[] }>("/api/v1/admin/audit-logs") });
  const logs = query.data?.items ?? [];
  const latestLog = logs[0];
  const uniqueActors = new Set(logs.map((log) => `${log.actorType}:${log.actorId ?? "unknown"}`)).size;
  const uniqueResources = new Set(logs.map((log) => `${log.resourceType}:${log.resourceId ?? "unknown"}`)).size;

  return (
    <>
      <Topbar title="Audit Logs" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Audit log"
            description="Aktivitas penting kini disusun dengan ritme yang lebih rapi agar perubahan sistem, pelaku, dan resource yang terdampak dapat ditelusuri dalam satu alur baca."
          />
          <DashboardPageMetrics
            items={[
              { label: "Aktivitas", value: String(logs.length), detail: "Total event yang berhasil dicatat." },
              { label: "Aktor unik", value: String(uniqueActors), detail: "Gabungan pengguna atau proses yang melakukan perubahan." },
              { label: "Resource unik", value: String(uniqueResources), detail: "Objek yang pernah disentuh oleh aktivitas audit." },
              {
                label: "Log terbaru",
                value: latestLog ? new Date(latestLog.createdAt).toLocaleDateString("id-ID") : "-",
                detail: latestLog ? latestLog.action : "Belum ada aktivitas yang tercatat.",
              },
            ]}
          />
          <DashboardTablePanel title="Aktivitas sistem" detail={`${logs.length} aktivitas tercatat untuk pemantauan dan kebutuhan penelusuran.`}>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              <tr>
                <th className="px-5 py-4">Waktu</th>
                <th className="px-5 py-4">Aktor</th>
                <th className="px-5 py-4">Aksi</th>
                <th className="px-5 py-4">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/80">
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-ink-700/35">
                  <td className="px-5 py-4 text-zinc-500">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-5 py-4 text-zinc-400">
                    {log.actorType}
                    {log.actorId ? ` · ${log.actorId.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-5 py-4 text-zinc-100">{log.action}</td>
                  <td className="px-5 py-4 text-zinc-500">
                    {log.resourceType}
                    {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <DashboardEmpty>Belum ada aktivitas.</DashboardEmpty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
