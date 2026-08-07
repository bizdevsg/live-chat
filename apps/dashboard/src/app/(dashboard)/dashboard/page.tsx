"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewData {
  totalChatToday: number;
  activeConversations: number;
  waitingAgent: number;
  aiResolvedCount: number;
  handoffCount: number;
  unresolvedCount: number;
  openTickets: number;
  agentsOnline: number;
  aiContainmentRate: number;
  customerSatisfactionAvg: number | null;
}

interface VolumePoint {
  date: string;
  count: number;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
    </Card>
  );
}

export default function OverviewPage() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => apiClient.get<OverviewData>("/api/v1/admin/overview") });
  const volume = useQuery({ queryKey: ["analytics", "conversations"], queryFn: () => apiClient.get<VolumePoint[]>("/api/v1/analytics/conversations") });

  return (
    <>
      <Topbar title="Overview" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        {overview.isLoading && <p className="text-sm text-zinc-500">Memuat data…</p>}
        {overview.data && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Chat hari ini" value={overview.data.totalChatToday} />
            <StatCard label="Conversation aktif" value={overview.data.activeConversations} />
            <StatCard label="Menunggu agent" value={overview.data.waitingAgent} />
            <StatCard label="Ticket terbuka" value={overview.data.openTickets} />
            <StatCard label="Agent online" value={overview.data.agentsOnline} />
            <StatCard label="AI containment rate" value={`${Math.round(overview.data.aiContainmentRate * 100)}%`} />
            <StatCard label="Handoff (hari ini)" value={overview.data.handoffCount} />
            <StatCard label="CSAT rata-rata" value={overview.data.customerSatisfactionAvg?.toFixed(1) ?? "—"} />
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Volume Chat (30 hari terakhir)</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volume.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26262a" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1c1c1f", border: "1px solid #26262a", fontSize: 12 }} />
                <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </main>
    </>
  );
}
