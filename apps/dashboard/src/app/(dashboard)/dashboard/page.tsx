"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  CircleAlert,
  Clock3,
  Hourglass,
  Inbox,
  LoaderCircle,
  MessagesSquare,
  Radio,
  RefreshCw,
  ShieldCheck,
  Star,
  Ticket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Permission } from "@/lib/permissions";
import { getDashboardSocket, isDashboardSocketReady } from "@/lib/socket";

interface OnlineAgent {
  userId: string;
  name: string;
  email: string;
  availability: "ONLINE" | "BUSY";
  activeChatCount: number;
  maxConcurrentChats: number;
}

interface OverviewData {
  totalChatToday: number;
  activeConversations: number;
  waitingAgent: number;
  aiResolvedCount: number;
  handoffCount: number;
  unresolvedCount: number;
  openTickets: number;
  agentsOnline: number;
  onlineAgents: OnlineAgent[];
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

function formatChartDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}

function PrimaryMetric({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <section
      className={cn(
        "group relative min-h-44 overflow-hidden rounded-2xl border px-5 py-5 transition-colors",
        accent
          ? "border-gold-400/60 bg-[linear-gradient(145deg,rgba(212,175,55,0.19),rgba(212,175,55,0.04)_62%)]"
          : "border-ink-600 bg-ink-800/65 hover:border-ink-500",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", accent ? "bg-gold-400 text-ink-950" : "bg-ink-700 text-zinc-400")}>
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        {accent ? <span className="rounded-full border border-gold-400/25 bg-gold-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">Perlu respons</span> : null}
      </div>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</p>
          <p className={cn("mt-2 text-4xl font-semibold tracking-[-0.04em]", accent ? "text-gold-300" : "text-zinc-50")}>{value}</p>
        </div>
        <p className="max-w-32 text-right text-xs leading-5 text-zinc-500">{detail}</p>
      </div>
    </section>
  );
}

function SecondaryMetric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-600 bg-ink-900 text-gold-500">
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-zinc-500">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{value}</p>
      </div>
      <span className="hidden max-w-28 text-right text-[11px] leading-4 text-zinc-600 2xl:block">{detail}</span>
    </div>
  );
}

function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-600/80 px-5 py-4 sm:px-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold text-zinc-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function PriorityRow({ icon: Icon, label, value, href, tone }: { icon: LucideIcon; label: string; value: number; href?: string; tone: "rose" | "gold" | "green" }) {
  const content = (
    <div className={cn("flex items-center gap-3 px-5 py-4 transition-colors", href && "hover:bg-ink-700/35")}>
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg", tone === "rose" ? "bg-rose-400/10 text-rose-400" : tone === "green" ? "bg-emerald-400/10 text-emerald-400" : "bg-gold-400/10 text-gold-400")}>
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-zinc-300">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-zinc-100">{value}</span>
      {href ? <ArrowRight className="h-4 w-4 text-zinc-600" aria-hidden="true" /> : null}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Memuat data beranda">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-ink-600 bg-ink-800/60" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <div className="h-[430px] animate-pulse rounded-2xl border border-ink-600 bg-ink-800/60" />
        <div className="h-[430px] animate-pulse rounded-2xl border border-ink-600 bg-ink-800/60" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const userName = useAuthStore((state) => state.user?.name);
  const canRunCleanup = hasPermission(Permission.SECURITY_MANAGE);
  const canOpenInbox = hasPermission(Permission.CONVERSATION_HANDLE);
  const canOpenTickets = hasPermission(Permission.TICKET_MANAGE);
  const [socketReady, setSocketReady] = useState(isDashboardSocketReady);
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiClient.get<OverviewData>("/api/v1/admin/overview"),
    enabled: socketReady,
  });
  const volume = useQuery({ queryKey: ["analytics", "conversations"], queryFn: () => apiClient.get<VolumePoint[]>("/api/v1/analytics/conversations") });

  useEffect(() => {
    const socket = getDashboardSocket();
    const refreshOverview = () => void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    const handleReady = () => {
      setSocketReady(true);
      refreshOverview();
    };
    const handleDisconnect = () => setSocketReady(false);
    socket.on("dashboard:ready", handleReady);
    socket.on("disconnect", handleDisconnect);
    socket.on("agent:status", refreshOverview);
    if (isDashboardSocketReady()) handleReady();
    return () => {
      socket.off("dashboard:ready", handleReady);
      socket.off("disconnect", handleDisconnect);
      socket.off("agent:status", refreshOverview);
    };
  }, [queryClient]);

  const cleanup = useMutation({
    mutationFn: () => apiClient.post<CleanupResult>("/api/v1/admin/maintenance/cleanup"),
    onSuccess: async (result) => {
      toast.push(result.message, "success");
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => toast.push(error instanceof ApiError ? error.message : "Gagal menjalankan cleanup.", "error"),
  });

  const data = overview.data;
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <>
      <Topbar title="Beranda" />
      <DashboardPage className="bg-[radial-gradient(circle_at_88%_-10%,rgba(212,175,55,0.09),transparent_32rem)]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <header className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/75 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:px-6 lg:px-7 lg:py-6">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gold-300 via-gold-500 to-transparent" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-[0.2em] text-gold-400">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
                    Live operations
                  </span>
                  <span className="h-3 w-px bg-ink-500" />
                  <span className="inline-flex items-center gap-1.5 capitalize text-zinc-500"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{today}</span>
                </div>
                <h1 className="mt-3 truncate text-2xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-3xl">Selamat datang{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Pantau antrean, kapasitas agent, dan performa layanan hari ini.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canRunCleanup ? (
                  <Button variant="secondary" className="h-10" disabled={cleanup.isPending} onClick={() => cleanup.mutate()}>
                    {cleanup.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
                    {cleanup.isPending ? "Memproses..." : "Run Cleanup"}
                  </Button>
                ) : null}
                {canOpenInbox ? (
                  <Link href="/inbox" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gold-400 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-gold-300">
                    <Inbox className="h-4 w-4" aria-hidden="true" />Buka Inbox
                  </Link>
                ) : null}
              </div>
            </div>
          </header>

          {!socketReady || overview.isLoading ? <LoadingState /> : data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <PrimaryMetric label="Menunggu agent" value={data.waitingAgent} detail="Percakapan butuh respons" icon={Hourglass} accent={data.waitingAgent > 0} />
                <PrimaryMetric label="Conversation aktif" value={data.activeConversations} detail="Sedang berlangsung" icon={Radio} />
                <PrimaryMetric label="Chat hari ini" value={data.totalChatToday} detail="Masuk sejak 00.00" icon={MessagesSquare} />
                <PrimaryMetric label="Ticket terbuka" value={data.openTickets} detail="Belum terselesaikan" icon={Ticket} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
                <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/65">
                  <PanelHeader eyebrow="Traffic" title="Volume chat · 30 hari" action={<span className="rounded-md bg-ink-900 px-2.5 py-1 text-xs text-zinc-500">Harian</span>} />
                  <div className="h-[340px] px-3 pb-5 pt-6 sm:h-[390px] sm:px-5">
                    {volume.isLoading ? <div className="h-full animate-pulse rounded-xl bg-ink-900/70" /> : volume.isError ? (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <CircleAlert className="h-6 w-6 text-rose-400" aria-hidden="true" />
                        <p className="mt-3 text-sm text-zinc-400">Grafik belum dapat dimuat.</p>
                        <Button className="mt-4" size="sm" variant="secondary" onClick={() => void volume.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Coba Lagi</Button>
                      </div>
                    ) : (volume.data?.length ?? 0) === 0 ? (
                      <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">Belum ada data percakapan dalam 30 hari terakhir.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volume.data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="#2c2c30" strokeDasharray="2 7" />
                          <XAxis dataKey="date" tickFormatter={formatChartDate} tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
                          <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: "rgba(212,175,55,0.05)" }} contentStyle={{ background: "#111113", border: "1px solid #3a3a3d", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#a1a1aa", marginBottom: 4 }} itemStyle={{ color: "#D4AF37" }} labelFormatter={(value) => formatChartDate(String(value))} formatter={(value) => [`${value} chat`, "Volume"]} />
                          <Bar dataKey="count" fill="#D4AF37" radius={[5, 5, 0, 0]} maxBarSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
                  <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/65">
                    <PanelHeader eyebrow="Live presence" title="Agent aktif" action={<span className="inline-flex min-w-8 items-center justify-center rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-300">{data.onlineAgents.length}</span>} />
                    {data.onlineAgents.length ? (
                      <ul className="scrollbar-thin max-h-72 divide-y divide-ink-600/70 overflow-y-auto" aria-label="Daftar agent aktif">
                        {data.onlineAgents.map((agent) => (
                          <li key={agent.userId} className="flex items-center gap-3 px-5 py-3.5">
                            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-400/10 text-xs font-semibold uppercase text-gold-400">
                              {agent.name.trim().charAt(0) || "A"}
                              <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-800", agent.availability === "BUSY" ? "bg-amber-400" : "bg-emerald-400")} />
                            </div>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-200">{agent.name}</p><p className="truncate text-xs text-zinc-600">{agent.email}</p></div>
                            <div className="text-right"><p className="text-sm font-semibold tabular-nums text-zinc-200">{agent.activeChatCount}<span className="text-zinc-600">/{agent.maxConcurrentChats}</span></p><p className={cn("text-[9px] font-semibold uppercase tracking-[0.14em]", agent.availability === "BUSY" ? "text-amber-400" : "text-emerald-400")}>{agent.availability === "BUSY" ? "Sibuk" : "Online"}</p></div>
                          </li>
                        ))}
                      </ul>
                    ) : <div className="px-5 py-9 text-center"><UsersRound className="mx-auto h-5 w-5 text-zinc-700" aria-hidden="true" /><p className="mt-2 text-sm text-zinc-500">Belum ada agent aktif.</p></div>}
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/65">
                    <PanelHeader eyebrow="Action queue" title="Prioritas sekarang" />
                    <div className="divide-y divide-ink-600/70">
                      <PriorityRow icon={Hourglass} label="Menunggu agent" value={data.waitingAgent} href={canOpenInbox ? "/inbox" : undefined} tone={data.waitingAgent ? "rose" : "green"} />
                      <PriorityRow icon={Clock3} label="Belum selesai" value={data.unresolvedCount} href={canOpenInbox ? "/inbox" : undefined} tone={data.unresolvedCount ? "gold" : "green"} />
                      <PriorityRow icon={Ticket} label="Ticket terbuka" value={data.openTickets} href={canOpenTickets ? "/tickets" : undefined} tone={data.openTickets ? "rose" : "green"} />
                    </div>
                  </section>
                </div>
              </div>

              <section className="grid overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/45 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:divide-ink-600 xl:grid-cols-4 [&>*]:border-b [&>*]:border-ink-600 sm:[&>*]:border-b-0">
                <SecondaryMetric icon={UsersRound} label="Agent aktif" value={data.agentsOnline} detail="Terhubung sekarang" />
                <SecondaryMetric icon={ShieldCheck} label="AI containment" value={`${Math.round(data.aiContainmentRate * 100)}%`} detail="Ditangani otomatis" />
                <SecondaryMetric icon={ArrowRightLeft} label="Handoff hari ini" value={data.handoffCount} detail="Dialihkan ke agent" />
                <SecondaryMetric icon={Star} label="CSAT rata-rata" value={data.customerSatisfactionAvg?.toFixed(1) ?? "-"} detail="Skor kepuasan" />
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-rose-500/20 bg-ink-800/70 p-10 text-center">
              <CircleAlert className="mx-auto h-7 w-7 text-rose-400" aria-hidden="true" />
              <h2 className="mt-3 text-base font-semibold text-zinc-200">Data beranda belum dapat dimuat</h2>
              <p className="mt-2 text-sm text-zinc-500">Periksa koneksi lalu coba muat ulang data.</p>
              <Button className="mt-5" variant="secondary" onClick={() => void overview.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Coba Lagi</Button>
            </div>
          )}
        </div>
      </DashboardPage>
    </>
  );
}
