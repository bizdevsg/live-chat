"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";

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

  return (
    <>
      <Topbar title="Audit Logs" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aktor</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Resource</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((log) => (
                <tr key={log.id} className="border-t border-ink-700">
                  <td className="px-4 py-3 text-zinc-500">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {log.actorType}
                    {log.actorId ? ` · ${log.actorId.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {log.resourceType}
                    {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
              {query.data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
                    Belum ada aktivitas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
