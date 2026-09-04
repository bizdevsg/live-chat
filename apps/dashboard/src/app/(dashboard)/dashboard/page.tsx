"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRightLeft,
  ArrowUpRight,
  CircleAlert,
  Clock3,
  Hourglass,
  Inbox,
  LoaderCircle,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Star,
  Ticket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Permission } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/components/ui/cn";

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

interface CleanupResult {
  jobId: string | number;
  queuedAt: string;
  message: string;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  emphasis?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-0.5",
        emphasis
          ? "border-gold-400 bg-gold-500 text-ink-950 shadow-[0_20px_50px_rgba(212,175,55,0.12)]"
          : "border-ink-600 bg-ink-800/70 text-zinc-100",
      )}
    >
      <Icon className={cn("mb-5 h-5 w-5", emphasis ? "text-ink-900" : "text-gold-500")} strokeWidth={1.8} aria-hidden="true" />
      <p className={cn("text-sm font-medium", emphasis ? "text-ink-900" : "text-zinc-300")}>{label}</p>
      <p className={cn("mt-2 text-4xl font-semibold tracking-tight", emphasis ? "text-ink-950" : "text-zinc-50")}>{value}</p>
      <p className={cn("mt-3 text-xs leading-5", emphasis ? "text-ink-800" : "text-zinc-500")}>{detail}</p>
    </section>
  );
}

function CompactRow({ icon: Icon, label, value, href, tone = "gold" }: { icon: LucideIcon; label: string; value: string | number; href?: string; tone?: "gold" | "rose" | "green" }) {
  const content = (
    <div className={cn("flex items-center gap-3 px-3.5 py-3 transition-colors", href && "hover:bg-ink-700/70")}>
      <Icon
        className={cn("h-4 w-4 shrink-0", tone === "rose" ? "text-rose-400" : tone === "green" ? "text-emerald-400" : "text-gold-500")}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 text-sm text-zinc-300">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", tone === "rose" ? "text-rose-300" : tone === "green" ? "text-emerald-300" : "text-gold-400")}>{value}</span>
      {href && <ArrowUpRight className="h-4 w-4 text-zinc-600" aria-hidden="true" />}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default function OverviewPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRunCleanup = hasPermission(Permission.SECURITY_MANAGE);
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => apiClient.get<OverviewData>("/api/v1/admin/overview") });
  const volume = useQuery({ queryKey: ["analytics", "conversations"], queryFn: () => apiClient.get<VolumePoint[]>("/api/v1/analytics/conversations") });
  const cleanup = useMutation({
    mutationFn: () => apiClient.post<CleanupResult>("/api/v1/admin/maintenance/cleanup"),
    onSuccess: async (result) => {
      toast.push(result.message, "success");
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      toast.push(error instanceof ApiError ? error.message : "Gagal menjalankan cleanup.", "error");
    },
  });
  const data = overview.data;

  return (
    <>
      <Topbar title="Beranda" />
      <main className="scrollbar-thin flex-1 overflow-y-auto bg-[radial-gradient(circle_at_78%_0%,rgba(212,175,55,0.08),transparent_26rem)] px-5 py-6 md:px-8 md:py-7">
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 md:text-4xl">Overview</h2>
              <p className="mt-2 text-sm text-zinc-500">Ringkasan performa chat dan operasi layanan hari ini.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canRunCleanup ? (
                <Button
                  variant="secondary"
                  className="h-11 rounded-xl px-4"
                  disabled={cleanup.isPending}
                  onClick={() => cleanup.mutate()}
                >
                  {cleanup.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
                  {cleanup.isPending ? "Menjalankan Cleanup..." : "Run Cleanup"}
                </Button>
              ) : null}
              <Link
                href="/inbox"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-transform hover:-translate-y-0.5 hover:bg-gold-400"
              >
                <Inbox className="h-4 w-4" aria-hidden="true" />
                Buka Inbox
              </Link>
            </div>
          </div>

          {overview.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl border border-ink-600 bg-ink-800/60" />
              ))}
            </div>
          ) : data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Chat hari ini" value={data.totalChatToday} detail="Total chat yang masuk hari ini" icon={MessagesSquare} />
                <MetricCard label="Conversation aktif" value={data.activeConversations} detail="Percakapan yang sedang berlangsung" icon={Radio} />
                <MetricCard label="Menunggu agent" value={data.waitingAgent} detail="Percakapan yang perlu ditangani" icon={Hourglass} emphasis />
                <MetricCard label="Ticket terbuka" value={data.openTickets} detail="Ticket yang belum terselesaikan" icon={Ticket} />
                <MetricCard label="Agent online" value={data.agentsOnline} detail="Agent tersedia saat ini" icon={UsersRound} />
                <MetricCard label="AI containment rate" value={`${Math.round(data.aiContainmentRate * 100)}%`} detail="Porsi chat yang ditangani AI" icon={ShieldCheck} />
                <MetricCard label="Handoff hari ini" value={data.handoffCount} detail="Chat yang dialihkan ke agent" icon={ArrowRightLeft} />
                <MetricCard label="CSAT rata-rata" value={data.customerSatisfactionAvg?.toFixed(1) ?? "-"} detail="Kepuasan pelanggan saat ini" icon={Star} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
                <section className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5 md:p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-100">Volume chat</h3>
                      <p className="mt-1 text-xs text-zinc-500">30 hari terakhir</p>
                    </div>
                    <div className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-xs font-medium text-zinc-400">30 hari terakhir</div>
                  </div>
                  <div className="h-72 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volume.data ?? []} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#2c2c30" strokeDasharray="2 6" />
                        <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
                        <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(212, 175, 55, 0.06)" }}
                          contentStyle={{ background: "#111113", border: "1px solid #3a3a3d", borderRadius: 12, fontSize: 12 }}
                          labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
                          itemStyle={{ color: "#D4AF37" }}
                          formatter={(value) => [`${value} chat`, "Volume"]}
                        />
                        <Bar dataKey="count" fill="#D4AF37" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <aside className="space-y-4">
                  <section className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-zinc-100">Prioritas sekarang</h3>
                      <CircleAlert className="h-5 w-5 text-gold-500" aria-hidden="true" />
                    </div>
                    <div className="overflow-hidden rounded-xl border border-ink-600/90 divide-y divide-ink-600/90">
                      <CompactRow icon={Hourglass} label="Menunggu agent" value={data.waitingAgent} href="/inbox" tone={data.waitingAgent > 0 ? "rose" : "green"} />
                      <CompactRow icon={Ticket} label="Ticket terbuka" value={data.openTickets} href="/tickets" tone={data.openTickets > 0 ? "rose" : "green"} />
                      <CompactRow icon={Clock3} label="Conversation belum selesai" value={data.unresolvedCount} href="/inbox" tone={data.unresolvedCount > 0 ? "gold" : "green"} />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-zinc-100">Kesehatan layanan</h3>
                      <Activity className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <div className="overflow-hidden rounded-xl border border-ink-600/90 divide-y divide-ink-600/90">
                      <CompactRow icon={UsersRound} label="Agent online" value={data.agentsOnline} tone={data.agentsOnline > 0 ? "green" : "rose"} />
                      <CompactRow icon={ShieldCheck} label="AI containment" value={`${Math.round(data.aiContainmentRate * 100)}%`} tone="green" />
                      <CompactRow icon={Star} label="CSAT rata-rata" value={data.customerSatisfactionAvg?.toFixed(1) ?? "-"} tone="gold" />
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-ink-600 bg-ink-800/70 p-8 text-sm text-zinc-500">Data overview belum dapat dimuat. Coba refresh halaman.</div>
          )}
        </div>
      </main>
    </>
  );
}
