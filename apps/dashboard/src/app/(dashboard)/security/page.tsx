"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  ipAddress: string | null;
  createdAt: string;
}

const SEVERITY_TONE: Record<string, "neutral" | "amber" | "red"> = { LOW: "neutral", MEDIUM: "amber", HIGH: "red", CRITICAL: "red" };

export default function SecurityPage() {
  const query = useQuery({
    queryKey: ["security-events"],
    queryFn: () => apiClient.get<{ items: SecurityEvent[] }>("/api/v1/admin/security-events"),
  });

  return (
    <>
      <Topbar title="Security" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((e) => (
                <tr key={e.id} className="border-t border-ink-700">
                  <td className="px-4 py-3 text-zinc-500">{new Date(e.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">{e.type}</td>
                  <td className="px-4 py-3">
                    <Badge tone={SEVERITY_TONE[e.severity] ?? "neutral"}>{e.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{e.ipAddress ?? "-"}</td>
                </tr>
              ))}
              {query.data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
                    Tidak ada security event.
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
