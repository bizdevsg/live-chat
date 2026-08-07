"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, API_URL } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AiPerf {
  totalAnswers: number;
  avgConfidence: number;
  avgLatencyMs: number;
  handoffCount: number;
}

interface AgentPerf {
  agentId: string;
  name: string;
  availability: string;
  totalHandled: number;
  totalResolved: number;
}

interface IntentRow {
  intent: string;
  count: number;
}

export default function AnalyticsPage() {
  const ai = useQuery({ queryKey: ["analytics", "ai"], queryFn: () => apiClient.get<AiPerf>("/api/v1/analytics/ai") });
  const agents = useQuery({ queryKey: ["analytics", "agents"], queryFn: () => apiClient.get<AgentPerf[]>("/api/v1/analytics/agents") });
  const intents = useQuery({ queryKey: ["analytics", "intents"], queryFn: () => apiClient.get<IntentRow[]>("/api/v1/analytics/intents") });

  return (
    <>
      <Topbar title="Analytics" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex justify-end">
          <a href={`${API_URL}/api/v1/analytics/export`} target="_blank" rel="noreferrer">
            <Button variant="secondary">Export CSV</Button>
          </a>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performa AI</CardTitle>
          </CardHeader>
          {ai.data && (
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-zinc-500">Total Jawaban</div>
                <div className="text-lg text-zinc-100">{ai.data.totalAnswers}</div>
              </div>
              <div>
                <div className="text-zinc-500">Rata-rata Confidence</div>
                <div className="text-lg text-zinc-100">{Math.round(ai.data.avgConfidence * 100)}%</div>
              </div>
              <div>
                <div className="text-zinc-500">Rata-rata Latensi</div>
                <div className="text-lg text-zinc-100">{Math.round(ai.data.avgLatencyMs)}ms</div>
              </div>
              <div>
                <div className="text-zinc-500">Handoff</div>
                <div className="text-lg text-zinc-100">{ai.data.handoffCount}</div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performa Agent</CardTitle>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2">Agent</th>
                <th className="py-2">Status</th>
                <th className="py-2">Ditangani</th>
                <th className="py-2">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {agents.data?.map((a) => (
                <tr key={a.agentId} className="border-t border-ink-700">
                  <td className="py-2">{a.name}</td>
                  <td className="py-2 text-zinc-400">{a.availability}</td>
                  <td className="py-2 text-zinc-400">{a.totalHandled}</td>
                  <td className="py-2 text-zinc-400">{a.totalResolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Intents</CardTitle>
          </CardHeader>
          <ul className="space-y-1 text-sm text-zinc-400">
            {intents.data?.map((i) => (
              <li key={i.intent} className="flex justify-between border-b border-ink-700 py-1.5">
                <span>{i.intent}</span>
                <span>{i.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </>
  );
}
