"use client";

import { startTransition, useDeferredValue, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, ChevronRight, CircleCheck, CircleDot, Clock3, Hourglass, Inbox, RefreshCw, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { DashboardPage, DashboardPageHeader, DashboardPageMetrics } from "@/components/layout/dashboard-page";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/components/ui/cn";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
}

interface TicketList {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_INTERNAL", "RESOLVED", "CLOSED", "REOPENED"];

const STATUS_META: Record<string, { label: string; tone: string; icon: typeof Clock3 }> = {
  OPEN: { label: "Terbuka", tone: "text-amber-400", icon: Clock3 },
  IN_PROGRESS: { label: "Diproses", tone: "text-gold-500", icon: Hourglass },
  WAITING_CUSTOMER: { label: "Menunggu customer", tone: "text-sky-400", icon: CircleDot },
  WAITING_INTERNAL: { label: "Menunggu internal", tone: "text-violet-400", icon: CircleDot },
  RESOLVED: { label: "Selesai", tone: "text-emerald-400", icon: CircleCheck },
  CLOSED: { label: "Ditutup", tone: "text-zinc-500", icon: CircleCheck },
  REOPENED: { label: "Dibuka kembali", tone: "text-rose-400", icon: RefreshCw },
};

const PRIORITY_META: Record<string, { label: string; tone: string }> = {
  URGENT: { label: "Mendesak", tone: "bg-rose-400" },
  HIGH: { label: "Tinggi", tone: "bg-orange-400" },
  NORMAL: { label: "Normal", tone: "bg-gold-500" },
  LOW: { label: "Rendah", tone: "bg-zinc-500" },
};

function countTickets(status: string) {
  return apiClient.get<TicketList>(`/api/v1/tickets?status=${status}`);
}

function StatusLabel({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "text-zinc-400", icon: CircleDot };
  const Icon = meta.icon;
  return <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm", meta.tone)}><Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />{meta.label}</span>;
}

function PriorityLabel({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, tone: "bg-zinc-500" };
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-zinc-400"><span className={cn("h-1.5 w-1.5 rounded-full", meta.tone)} aria-hidden="true" />{meta.label}</span>;
}

const COUNT_STATUSES: Array<{ status: string; label: string; tone?: "warn" }> = [
  { status: "OPEN", label: "Terbuka", tone: "warn" },
  { status: "IN_PROGRESS", label: "Diproses" },
  { status: "WAITING_CUSTOMER", label: "Menunggu customer" },
  { status: "RESOLVED", label: "Selesai" },
];

function TicketCounts() {
  const results = useQueries({
    queries: COUNT_STATUSES.map(({ status }) => ({ queryKey: ["tickets", "count", status], queryFn: () => countTickets(status) })),
  });
  return (
    <DashboardPageMetrics
      items={COUNT_STATUSES.map((item, index) => ({
        label: item.label,
        value: String(results[index]?.data?.total ?? 0),
        tone: item.tone && (results[index]?.data?.total ?? 0) > 0 ? item.tone : undefined,
      }))}
    />
  );
}

export default function TicketsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ["tickets", status, page],
    queryFn: () => apiClient.get<TicketList>(`/api/v1/tickets?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`),
  });
  const tickets = (query.data?.items ?? []).filter((ticket) => `${ticket.ticketNumber} ${ticket.subject} ${ticket.category}`.toLocaleLowerCase("id-ID").includes(deferredSearch.toLocaleLowerCase("id-ID")));
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.pageSize ?? 20)));

  function handleStatusChange(nextStatus: string) {
    startTransition(() => { setStatus(nextStatus); setPage(1); });
  }

  return <><Topbar title="Tickets" /><DashboardPage><div className="space-y-5">
    <DashboardPageHeader title="Tickets" description="Kelola dan tindak lanjuti setiap permintaan customer." />

    <TicketCounts />

    <section className="overflow-hidden rounded-xl border border-ink-600 bg-ink-800"><div className="flex flex-col gap-3 border-b border-ink-600 px-5 py-3 lg:flex-row lg:items-center lg:justify-between"><p className="text-sm text-zinc-500">Menampilkan <span className="font-medium text-zinc-300">{tickets.length}</span> dari {query.data?.total ?? 0} ticket{status ? ` · ${STATUS_META[status]?.label ?? status}` : ""}</p><div className="flex flex-col gap-2 sm:flex-row"><label className="relative block"><span className="sr-only">Cari ticket</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor atau subjek..." className="h-9 w-full rounded-lg border border-ink-600 bg-ink-800 py-1.5 pl-10 pr-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500 sm:w-72" /></label><Select value={status} onChange={(event) => handleStatusChange(event.target.value)} className="h-9 min-w-44"><option value="">Semua status</option>{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{STATUS_META[option]?.label ?? option}</option>)}</Select><Button variant="secondary" onClick={() => query.refetch()} className="h-9 gap-2"><RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} aria-hidden="true" />Refresh</Button></div></div>
      <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-ink-700/45 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 font-medium">Nomor ticket</th><th className="px-5 py-3 font-medium">Subjek</th><th className="px-5 py-3 font-medium">Kategori</th><th className="px-5 py-3 font-medium">Prioritas</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Dibuat</th><th className="w-10 px-3 py-3"><span className="sr-only">Buka ticket</span></th></tr></thead><tbody className="divide-y divide-ink-600/80">
        {tickets.map((ticket) => <tr key={ticket.id} className="group transition-colors hover:bg-ink-700/45"><td className="px-5 py-3.5"><Link href={`/tickets/${ticket.id}`} className="font-medium text-gold-500 hover:text-gold-400">{ticket.ticketNumber}</Link></td><td className="max-w-[360px] px-5 py-3.5"><Link href={`/tickets/${ticket.id}`} className="block truncate font-medium text-zinc-200">{ticket.subject}</Link></td><td className="px-5 py-4 text-zinc-400">{ticket.category}</td><td className="px-5 py-3.5"><PriorityLabel priority={ticket.priority} /></td><td className="px-5 py-3.5"><StatusLabel status={ticket.status} /></td><td className="whitespace-nowrap px-5 py-4 text-zinc-500">{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(ticket.createdAt))}</td><td className="px-3 py-4"><Link href={`/tickets/${ticket.id}`} aria-label={`Buka ${ticket.ticketNumber}`} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-600 transition-colors group-hover:bg-ink-600 group-hover:text-gold-400"><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></td></tr>)}
        {query.isLoading ? <tr><td colSpan={7} className="px-5 py-14 text-center text-zinc-500">Memuat ticket...</td></tr> : null}
        {!query.isLoading && tickets.length === 0 ? <tr><td colSpan={7} className="px-5 py-14 text-center"><Inbox className="mx-auto h-7 w-7 text-zinc-600" aria-hidden="true" /><p className="mt-3 text-sm text-zinc-500">Tidak ada ticket yang sesuai.</p></td></tr> : null}
      </tbody></table></div>
      <footer className="flex items-center justify-between border-t border-ink-600 px-5 py-3"><p className="text-xs text-zinc-600">Halaman {page} dari {totalPages}</p><div className="flex items-center gap-2"><Button variant="secondary" className="h-8 px-2.5" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Halaman sebelumnya</span></Button><Button variant="secondary" className="h-8 px-2.5" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Halaman berikutnya</span></Button></div></footer>
    </section>
  </div></DashboardPage></>;
}
