"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  strategy: string;
  isActive: boolean;
  targetTeamId: string | null;
}

interface HandoffRule {
  id: string;
  reason: string;
  priority: string;
  isActive: boolean;
  targetTeamId: string | null;
}

export default function RoutingPage() {
  const routing = useQuery({ queryKey: ["routing-rules"], queryFn: () => apiClient.get<RoutingRule[]>("/api/v1/admin/routing-rules") });
  const handoff = useQuery({ queryKey: ["handoff-rules"], queryFn: () => apiClient.get<HandoffRule[]>("/api/v1/admin/handoff-rules") });

  return (
    <>
      <Topbar title="Routing Rules" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Routing Rules</CardTitle>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2">Nama</th>
                <th className="py-2">Strategi</th>
                <th className="py-2">Prioritas</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {routing.data?.map((r) => (
                <tr key={r.id} className="border-t border-ink-700">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-zinc-400">{r.strategy}</td>
                  <td className="py-2 text-zinc-400">{r.priority}</td>
                  <td className="py-2">
                    <Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handoff Rules (§18)</CardTitle>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2">Alasan</th>
                <th className="py-2">Prioritas</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {handoff.data?.map((r) => (
                <tr key={r.id} className="border-t border-ink-700">
                  <td className="py-2">{r.reason}</td>
                  <td className="py-2 text-zinc-400">{r.priority}</td>
                  <td className="py-2">
                    <Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
