"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CircleCheck, CircleDot, Clock3, Mail, MessageSquareText, RefreshCw, Send, Tag, Ticket, UserRound } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/components/ui/cn";

interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  resolution: string | null;
  comments: Array<{ id: string; content: string; isInternal: boolean; createdAt: string }>;
  customer: { id: string; name: string; email: string | null; phone: string | null; accountStatus: string | null; tags: Array<{ tag: { id: string; name: string } }> } | null;
}

const STATUS_META: Record<string, { label: string; tone: string; icon: typeof Clock3 }> = {
  OPEN: { label: "Terbuka", tone: "text-amber-400", icon: Clock3 },
  IN_PROGRESS: { label: "Diproses", tone: "text-gold-500", icon: CircleDot },
  WAITING_CUSTOMER: { label: "Menunggu customer", tone: "text-sky-400", icon: CircleDot },
  WAITING_INTERNAL: { label: "Menunggu internal", tone: "text-violet-400", icon: CircleDot },
  RESOLVED: { label: "Selesai", tone: "text-emerald-400", icon: CircleCheck },
  CLOSED: { label: "Ditutup", tone: "text-zinc-500", icon: CircleCheck },
  REOPENED: { label: "Dibuka kembali", tone: "text-rose-400", icon: RefreshCw },
};

const PRIORITY_LABEL: Record<string, string> = { URGENT: "Mendesak", HIGH: "Tinggi", NORMAL: "Normal", LOW: "Rendah" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StatusLabel({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "text-zinc-400", icon: CircleDot };
  const Icon = meta.icon;
  return <span className={cn("inline-flex items-center gap-2 text-sm font-medium", meta.tone)}><Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />{meta.label}</span>;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 py-2 text-sm"><dt className="text-zinc-500">{label}</dt><dd className="min-w-0 text-zinc-300">{children}</dd></div>;
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [resolution, setResolution] = useState("");
  const query = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => apiClient.get<TicketDetail>(`/api/v1/tickets/${ticketId}`) });

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) => apiClient.post(path, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (error) => toast.push(error instanceof ApiError ? error.message : "Aksi gagal.", "error"),
  });

  if (query.isLoading) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat ticket...</div>;
  if (!query.data) return <div className="flex-1 p-6 text-sm text-zinc-500">Ticket tidak ditemukan.</div>;
  const ticket = query.data;
  const isFinal = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  function addComment() {
    const content = comment.trim();
    if (!content) return;
    action.mutate({ path: `/api/v1/tickets/${ticketId}/comments`, body: { content, isInternal: true } }, { onSuccess: () => setComment("") });
  }

  function resolveTicket() {
    const nextResolution = resolution.trim();
    if (!nextResolution) return;
    action.mutate({ path: `/api/v1/tickets/${ticketId}/resolve`, body: { resolution: nextResolution } }, { onSuccess: () => setResolution("") });
  }

  return <><Topbar title={`Ticket ${ticket.ticketNumber}`} /><main className="scrollbar-thin flex-1 overflow-y-auto bg-[radial-gradient(circle_at_80%_0%,rgba(212,175,55,0.08),transparent_26rem)] px-5 py-6 md:px-8 md:py-7"><div className="mx-auto max-w-[1480px]">
    <header className="mb-6"><Link href="/tickets" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-gold-400"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Kembali ke tickets</Link><div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><div className="flex items-center gap-3"><p className="text-sm font-medium text-gold-500">{ticket.ticketNumber}</p><StatusLabel status={ticket.status} /></div><h1 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">{ticket.subject}</h1></div><div className="flex shrink-0 gap-2">{ticket.status === "RESOLVED" ? <Button variant="secondary" onClick={() => action.mutate({ path: `/api/v1/tickets/${ticketId}/close` })} disabled={action.isPending}>Tutup ticket</Button> : null}{isFinal ? <Button variant="secondary" onClick={() => action.mutate({ path: `/api/v1/tickets/${ticketId}/reopen` })} disabled={action.isPending}><RefreshCw className="h-4 w-4" aria-hidden="true" />Buka kembali</Button> : null}</div></div></header>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
      <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/70"><section className="p-5 md:p-6"><div className="flex items-center gap-2 text-gold-500"><Ticket className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /><h2 className="font-semibold">Deskripsi</h2></div><div className="mt-5 grid gap-4 border-b border-ink-600 pb-5 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-zinc-600">Kategori</p><p className="mt-2 text-sm text-zinc-300">{ticket.category}</p></div><div><p className="text-xs uppercase tracking-wide text-zinc-600">Prioritas</p><p className="mt-2 text-sm text-zinc-300">{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</p></div></div><p className="whitespace-pre-wrap pt-5 text-sm leading-7 text-zinc-300">{ticket.description}</p></section>
        <section className="border-t border-ink-600 p-5 md:p-6"><div className="flex items-center gap-2 text-gold-500"><Check className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /><h2 className="font-semibold">Resolusi</h2></div>{ticket.resolution ? <p className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm leading-6 text-emerald-100">{ticket.resolution}</p> : null}{!isFinal ? <><p className="mt-2 text-sm text-zinc-500">Tuliskan penyelesaian sebelum menandai ticket sebagai selesai.</p><Textarea value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Tulis resolusi yang akan dikirim ke customer..." className="mt-4 min-h-28" /><div className="mt-3 flex justify-end"><Button onClick={resolveTicket} disabled={!resolution.trim() || action.isPending}><Check className="h-4 w-4" aria-hidden="true" />Tandai selesai</Button></div></> : null}</section>
        <section className="border-t border-ink-600 p-5 md:p-6"><div className="flex items-center gap-2 text-gold-500"><MessageSquareText className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /><h2 className="font-semibold">Komentar internal</h2></div><p className="mt-2 text-sm text-zinc-500">Catatan ini hanya terlihat oleh tim internal.</p><Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tambahkan komentar internal..." className="mt-4 min-h-24" /><div className="mt-3 flex justify-end"><Button onClick={addComment} disabled={!comment.trim() || action.isPending}><Send className="h-4 w-4" aria-hidden="true" />Kirim komentar</Button></div><div className="mt-6 divide-y divide-ink-600/80">{ticket.comments.map((item) => <article key={item.id} className="py-4 first:pt-0"><div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-zinc-300">Catatan internal</span><time className="shrink-0 text-xs text-zinc-600">{formatDate(item.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{item.content}</p></article>)}{ticket.comments.length === 0 ? <p className="py-5 text-center text-sm text-zinc-500">Belum ada komentar internal.</p> : null}</div></section></div>
      <aside className="space-y-4"><section className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><div className="flex items-center gap-2 text-gold-500"><UserRound className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /><h2 className="font-semibold">Data customer</h2></div>{ticket.customer ? <><p className="mt-5 text-base font-semibold text-zinc-100">{ticket.customer.name}</p><dl className="mt-3 divide-y divide-ink-600/80"><DetailRow label="Email">{ticket.customer.email ? <a href={`mailto:${ticket.customer.email}`} className="inline-flex min-w-0 items-center gap-2 break-all text-zinc-300 hover:text-gold-400"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{ticket.customer.email}</a> : "-"}</DetailRow><DetailRow label="Telepon">{ticket.customer.phone ?? "-"}</DetailRow><DetailRow label="Status akun">{ticket.customer.accountStatus ?? "-"}</DetailRow></dl>{ticket.customer.tags.length > 0 ? <div className="mt-4 flex flex-wrap gap-1.5">{ticket.customer.tags.map(({ tag }) => <Badge key={tag.id}>{tag.name}</Badge>)}</div> : null}</> : <p className="mt-4 text-sm text-zinc-500">Ticket ini belum tertaut ke customer.</p>}</section>
        <section className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5"><div className="flex items-center gap-2 text-gold-500"><Tag className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /><h2 className="font-semibold">Detail ticket</h2></div><dl className="mt-4 divide-y divide-ink-600/80"><DetailRow label="Nomor">{ticket.ticketNumber}</DetailRow><DetailRow label="Dibuat">{formatDate(ticket.createdAt)}</DetailRow><DetailRow label="Kategori">{ticket.category}</DetailRow><DetailRow label="Prioritas">{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</DetailRow><DetailRow label="Status"><StatusLabel status={ticket.status} /></DetailRow></dl></section></aside>
    </div>
  </div></main></>;
}
