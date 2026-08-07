"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  return (
    <>
      <Topbar title="AI Runs" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Tujuan</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Latensi</th>
                <th className="px-4 py-3">Handoff</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((run) => (
                <tr key={run.id} className="border-t border-ink-700 hover:bg-ink-700/40">
                  <td className="px-4 py-3 text-zinc-500">{new Date(run.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">{run.purpose}</td>
                  <td className="px-4 py-3 text-zinc-400">{run.model}</td>
                  <td className="px-4 py-3 text-zinc-400">{run.intent ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-400">{run.confidence != null ? `${Math.round(run.confidence * 100)}%` : "-"}</td>
                  <td className="px-4 py-3 text-zinc-400">{run.latencyMs ? `${run.latencyMs}ms` : "-"}</td>
                  <td className="px-4 py-3">{run.handoffRequired && <Badge tone="amber">Handoff</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
