"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface AiRun {
  id: string;
  conversationId: string;
  purpose: string;
  provider: string;
  model: string;
  status: string;
  confidence: number | null;
  intent: string | null;
  latencyMs: number | null;
  handoffRequired: boolean | null;
  createdAt: string;
}

export default function AiRunsPage() {
  const query = useQuery({ queryKey: ["ai-runs"], queryFn: () => apiClient.get<{ items: AiRun[] }>("/api/v1/ai/runs") });
  const runs = query.data?.items ?? [];
  const handoffCount = runs.filter((run) => run.handoffRequired).length;
  const averageLatency =
    runs.filter((run) => run.latencyMs != null).reduce((total, run) => total + (run.latencyMs ?? 0), 0) /
    Math.max(runs.filter((run) => run.latencyMs != null).length, 1);
  const averageConfidence =
    runs.filter((run) => run.confidence != null).reduce((total, run) => total + (run.confidence ?? 0), 0) /
    Math.max(runs.filter((run) => run.confidence != null).length, 1);

  return (
    <>
      <Topbar title="AI Runs" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="AI runs"
            description="Jejak eksekusi AI ditata ulang untuk membantu tim membaca performa model, kecepatan respons, dan kebutuhan handoff manusia dengan lebih jelas."
          />
          <DashboardPageMetrics
            items={[
              { label: "Run tercatat", value: String(runs.length), detail: "Semua eksekusi AI yang tersedia pada log saat ini." },
              { label: "Handoff", value: String(handoffCount), detail: "Run yang menandakan kebutuhan eskalasi ke manusia." },
              { label: "Rata-rata latensi", value: Number.isFinite(averageLatency) ? `${Math.round(averageLatency)} ms` : "-", detail: "Performa respons model di seluruh run yang punya data latensi." },
              { label: "Confidence rata-rata", value: Number.isFinite(averageConfidence) ? `${Math.round(averageConfidence * 100)}%` : "-", detail: "Indikasi keyakinan model terhadap hasil intent atau keputusan." },
            ]}
          />
          <DashboardTablePanel title="Execution timeline" detail={`${runs.length} run AI tersedia untuk ditinjau.`}>
          <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              <tr>
                <th className="px-5 py-4">Waktu</th>
                <th className="px-5 py-4">Tujuan</th>
                <th className="px-5 py-4">Model</th>
                <th className="px-5 py-4">Intent</th>
                <th className="px-5 py-4">Confidence</th>
                <th className="px-5 py-4">Latensi</th>
                <th className="px-5 py-4">Handoff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/80">
              {runs.map((run) => (
                <tr key={run.id} className="transition-colors hover:bg-ink-700/35">
                  <td className="px-5 py-4 text-zinc-500">{new Date(run.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-zinc-100">{run.purpose}</div>
                    <div className="mt-1 text-xs text-zinc-500">{run.provider}</div>
                  </td>
                  <td className="px-5 py-4 text-zinc-400">{run.model}</td>
                  <td className="px-5 py-4 text-zinc-400">{run.intent ?? "-"}</td>
                  <td className="px-5 py-4 text-zinc-400">{run.confidence != null ? `${Math.round(run.confidence * 100)}%` : "-"}</td>
                  <td className="px-5 py-4 text-zinc-400">{run.latencyMs ? `${run.latencyMs} ms` : "-"}</td>
                  <td className="px-5 py-4">{run.handoffRequired ? <Badge tone="amber">Handoff</Badge> : <span className="text-zinc-600">-</span>}</td>
                </tr>
              ))}
              {!query.isLoading && runs.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <DashboardEmpty>Belum ada AI run yang tercatat.</DashboardEmpty>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
