"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

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
  const events = query.data?.items ?? [];
  const highSeverityCount = events.filter((event) => ["HIGH", "CRITICAL"].includes(event.severity)).length;
  const mediumSeverityCount = events.filter((event) => event.severity === "MEDIUM").length;
  const uniqueIps = new Set(events.map((event) => event.ipAddress).filter(Boolean)).size;

  return (
    <>
      <Topbar title="Security" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Security"
            description="Halaman keamanan kini difokuskan pada pembacaan sinyal insiden, distribusi severity, dan sumber trafik yang perlu perhatian cepat."
          />
          <DashboardPageMetrics
            items={[
              { label: "Event", value: String(events.length), detail: "Seluruh security event yang tersedia pada log." },
              { label: "High + critical", value: String(highSeverityCount), detail: "Event yang perlu eskalasi atau investigasi segera." },
              { label: "Medium", value: String(mediumSeverityCount), detail: "Event yang perlu pemantauan lanjutan." },
              { label: "IP unik", value: String(uniqueIps), detail: "Jumlah sumber IP berbeda yang tercatat." },
            ]}
          />
          <DashboardTablePanel title="Security events" detail={`${events.length} event tersedia untuk ditinjau oleh tim keamanan dan operasional.`}>
          <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              <tr>
                <th className="px-5 py-4">Waktu</th>
                <th className="px-5 py-4">Tipe</th>
                <th className="px-5 py-4">Severity</th>
                <th className="px-5 py-4">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/80">
              {events.map((event) => (
                <tr key={event.id} className="transition-colors hover:bg-ink-700/35">
                  <td className="px-5 py-4 text-zinc-500">{new Date(event.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-5 py-4 text-zinc-100">{event.type}</td>
                  <td className="px-5 py-4">
                    <Badge tone={SEVERITY_TONE[event.severity] ?? "neutral"}>{event.severity}</Badge>
                  </td>
                  <td className="px-5 py-4 text-zinc-500">{event.ipAddress ?? "-"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <DashboardEmpty>Tidak ada security event.</DashboardEmpty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
