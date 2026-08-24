"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft, Bot, BrainCircuit, CircleAlert, Download, Gauge, MessagesSquare,
  ShieldCheck, Star, Timer, type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiClient, API_URL } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

interface OverviewData { totalConversations: number; aiContainmentRate: number; handoffRate: number; resolvedRate: number; ticketCount: number; leadCount: number; }
interface AiPerf { totalAnswers: number; avgConfidence: number; avgLatencyMs: number; handoffCount: number; }
interface AgentPerf { agentId: string; name: string; availability: string | null; activeChatCount: number | null; totalHandled: number; totalResolved: number; }
interface IntentRow { intent: string; count: number; }
interface VolumePoint { date: string; count: number; }
interface KnowledgeGap { aiRunId: string; conversationId: string; intent: string | null; confidence: number | null; createdAt: string; }
interface SatisfactionData { totalRatings: number; averageScore: number | null; }

const RANGE_OPTIONS = [
  { value: "7", label: "7 hari terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
];

function formatNumber(value: number) { return new Intl.NumberFormat("id-ID").format(value); }
function formatPercent(value: number) { return `${Math.round(value * 100)}%`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${value}T00:00:00`)); }

function MetricCard({ label, value, detail, icon: Icon, emphasis = false }: { label: string; value: string | number; detail: string; icon: LucideIcon; emphasis?: boolean }) {
  return <section className={cn("rounded-2xl border p-5", emphasis ? "border-gold-400 bg-gold-500 text-ink-950 shadow-[0_20px_50px_rgba(212,175,55,0.12)]" : "border-ink-600 bg-ink-800/70 text-zinc-100")}>
    <Icon className={cn("mb-5 h-5 w-5", emphasis ? "text-ink-900" : "text-gold-500")} strokeWidth={1.8} aria-hidden="true" />
    <p className={cn("text-sm font-medium", emphasis ? "text-ink-900" : "text-zinc-300")}>{label}</p><p className={cn("mt-2 text-4xl font-semibold tracking-tight", emphasis ? "text-ink-950" : "text-zinc-50")}>{value}</p><p className={cn("mt-3 text-xs leading-5", emphasis ? "text-ink-800" : "text-zinc-500")}>{detail}</p>
  </section>;
}

function AiStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return <div className="border-l border-ink-600 pl-4 first:border-l-0 first:pl-0"><Icon className="h-5 w-5 text-gold-500" strokeWidth={1.8} aria-hidden="true" /><p className="mt-5 text-xs text-zinc-500">{label}</p><p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-100">{value}</p></div>;
}

function SectionTitle({ children, detail }: { children: ReactNode; detail?: string }) {
  return <div className="mb-5"><h2 className="text-base font-semibold text-zinc-100">{children}</h2>{detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}</div>;
}

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState("30");
  const [rangeEnd] = useState(() => new Date());
  const days = Number(rangeDays);
  const to = rangeEnd;
  const from = new Date(rangeEnd);
  from.setDate(from.getDate() - days);
  const filters = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();
  const queryPath = (path: string) => `${path}?${filters}`;

  // Independent analytics endpoints are fetched in parallel by React Query.
  const overview = useQuery({ queryKey: ["analytics", "overview", rangeDays], queryFn: () => apiClient.get<OverviewData>(queryPath("/api/v1/analytics/overview")) });
  const volume = useQuery({ queryKey: ["analytics", "conversations", rangeDays], queryFn: () => apiClient.get<VolumePoint[]>(queryPath("/api/v1/analytics/conversations")) });
  const ai = useQuery({ queryKey: ["analytics", "ai", rangeDays], queryFn: () => apiClient.get<AiPerf>(queryPath("/api/v1/analytics/ai")) });
  const agents = useQuery({ queryKey: ["analytics", "agents"], queryFn: () => apiClient.get<AgentPerf[]>("/api/v1/analytics/agents") });
  const intents = useQuery({ queryKey: ["analytics", "intents", rangeDays], queryFn: () => apiClient.get<IntentRow[]>(queryPath("/api/v1/analytics/intents")) });
  const gaps = useQuery({ queryKey: ["analytics", "knowledge-gaps", rangeDays], queryFn: () => apiClient.get<KnowledgeGap[]>(queryPath("/api/v1/analytics/knowledge-gaps")) });
  const satisfaction = useQuery({ queryKey: ["analytics", "customer-satisfaction", rangeDays], queryFn: () => apiClient.get<SatisfactionData>(queryPath("/api/v1/analytics/customer-satisfaction")) });

  const maxIntentCount = intents.data?.reduce((max, item) => Math.max(max, item.count), 0) ?? 0;
  const exportUrl = `${API_URL}/api/v1/analytics/export?${filters}`;
  const data = overview.data;

  return <><Topbar title="Analytics" /><main className="scrollbar-thin flex-1 overflow-y-auto bg-[radial-gradient(circle_at_78%_0%,rgba(212,175,55,0.08),transparent_26rem)] px-5 py-6 md:px-8 md:py-7"><div className="mx-auto max-w-[1480px]">
    <header className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-medium text-gold-500">Data operasional</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Kinerja layanan, dalam satu pandangan.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Pantau performa percakapan, AI, dan tim support untuk periode yang dipilih.</p></div><div className="flex items-center gap-3"><label className="sr-only" htmlFor="analytics-range">Periode analitik</label><select id="analytics-range" value={rangeDays} onChange={(event) => setRangeDays(event.target.value)} className="h-10 rounded-lg border border-ink-600 bg-ink-800 px-3 text-sm text-zinc-200 outline-none transition-colors focus:border-gold-500">{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><a href={exportUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-2"><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button></a></div></header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total percakapan" value={formatNumber(data?.totalConversations ?? 0)} detail={`${days} hari terakhir`} icon={MessagesSquare} /><MetricCard label="Containment AI" value={formatPercent(data?.aiContainmentRate ?? 0)} detail="Percakapan yang tetap ditangani AI" icon={ShieldCheck} /><MetricCard label="Tingkat selesai" value={formatPercent(data?.resolvedRate ?? 0)} detail="Percakapan berstatus resolved" icon={Gauge} /><MetricCard label="Handoff AI" value={formatPercent(data?.handoffRate ?? 0)} detail="Percakapan yang dialihkan ke agent" icon={ArrowRightLeft} emphasis /></section>

    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)]"><article className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><SectionTitle detail="Jumlah percakapan baru per hari">Volume percakapan</SectionTitle><div className="h-72" aria-label="Grafik volume percakapan"><ResponsiveContainer width="100%" height="100%"><BarChart data={volume.data ?? []} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#34363b" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatDate} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: "#8d8f95", fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#8d8f95", fontSize: 11 }} /><Tooltip cursor={{ fill: "rgba(212,175,55,0.06)" }} contentStyle={{ background: "#1e2024", border: "1px solid #484a50", borderRadius: 10 }} labelFormatter={formatDate} formatter={(value) => [formatNumber(Number(value)), "Percakapan"]} /><Bar dataKey="count" radius={[5, 5, 0, 0]} fill="#d4af37" maxBarSize={38} /></BarChart></ResponsiveContainer></div></article>
      <article className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><SectionTitle detail="Respons AI pada periode ini">Performa AI</SectionTitle><div className="grid grid-cols-2 gap-x-5 gap-y-7"><AiStat label="Jawaban total" value={formatNumber(ai.data?.totalAnswers ?? 0)} icon={Bot} /><AiStat label="Rata-rata confidence" value={formatPercent(ai.data?.avgConfidence ?? 0)} icon={BrainCircuit} /><AiStat label="Rata-rata latensi" value={`${formatNumber(Math.round(ai.data?.avgLatencyMs ?? 0))} ms`} icon={Timer} /><AiStat label="Handoff diperlukan" value={formatNumber(ai.data?.handoffCount ?? 0)} icon={ArrowRightLeft} /></div><div className="mt-8 flex items-center justify-between border-t border-ink-600 pt-4 text-sm"><span className="text-zinc-500">Tiket dibuat</span><span className="font-semibold text-zinc-100">{formatNumber(data?.ticketCount ?? 0)}</span></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-zinc-500">Lead terkumpul</span><span className="font-semibold text-zinc-100">{formatNumber(data?.leadCount ?? 0)}</span></div></article></section>

    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.9fr)_minmax(310px,0.8fr)]"><article className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><SectionTitle detail="Akumulasi seluruh percakapan yang pernah ditangani">Performa agent</SectionTitle><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-ink-600 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="pb-3 font-medium">Agent</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Ditangani</th><th className="pb-3 text-right font-medium">Selesai</th></tr></thead><tbody className="divide-y divide-ink-600/80">{(agents.data ?? []).map((agent) => <tr key={agent.agentId}><td className="py-3.5 font-medium text-zinc-200">{agent.name}</td><td className="py-3.5 text-zinc-500">{agent.availability ?? "Tidak tersedia"}</td><td className="py-3.5 text-right tabular-nums text-zinc-300">{formatNumber(agent.totalHandled)}</td><td className="py-3.5 text-right tabular-nums text-gold-400">{formatNumber(agent.totalResolved)}</td></tr>)}{agents.data?.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-zinc-500">Belum ada agent untuk ditampilkan.</td></tr> : null}</tbody></table></div></article>
      <article className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><SectionTitle detail="Maksud percakapan yang paling sering muncul">Top intents</SectionTitle><div className="space-y-4">{(intents.data ?? []).slice(0, 6).map((intent, index) => <div key={intent.intent}><div className="mb-1.5 flex items-center gap-3 text-sm"><span className="w-4 text-xs text-zinc-600">{index + 1}</span><span className="min-w-0 flex-1 truncate text-zinc-300">{intent.intent}</span><span className="tabular-nums text-zinc-500">{formatNumber(intent.count)}</span></div><div className="ml-7 h-1.5 overflow-hidden rounded-full bg-ink-600"><div className="h-full rounded-full bg-gold-500" style={{ width: `${maxIntentCount ? (intent.count / maxIntentCount) * 100 : 0}%` }} /></div></div>)}{intents.data?.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Belum ada intent pada periode ini.</p> : null}</div></article>
      <div className="grid gap-3"><article className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><SectionTitle detail="Jawaban AI yang memerlukan handoff">Knowledge gaps</SectionTitle><div className="divide-y divide-ink-600/80">{(gaps.data ?? []).slice(0, 4).map((gap) => <div key={gap.aiRunId} className="py-3 first:pt-0"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" /><p className="min-w-0 truncate text-sm text-zinc-300">{gap.intent ?? "Intent tidak terdeteksi"}</p></div><p className="mt-1 pl-6 text-xs text-zinc-600">Confidence {formatPercent(gap.confidence ?? 0)}</p></div>)}{gaps.data?.length === 0 ? <p className="py-5 text-center text-sm text-zinc-500">Tidak ada knowledge gap pada periode ini.</p> : null}</div></article><article className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-100">Kepuasan pelanggan</p><p className="mt-1 text-xs text-zinc-500">Dari feedback yang diterima</p></div><Star className="h-5 w-5 text-gold-500" aria-hidden="true" /></div><div className="mt-5 flex items-end gap-2"><span className="text-4xl font-semibold tracking-tight text-zinc-50">{satisfaction.data?.averageScore?.toFixed(1) ?? "-"}</span><span className="mb-1 text-sm text-zinc-500">/ 5</span></div><p className="mt-3 text-sm text-zinc-400">{formatNumber(satisfaction.data?.totalRatings ?? 0)} penilaian pada periode ini</p></article></div></section>
  </div></main></>;
}
