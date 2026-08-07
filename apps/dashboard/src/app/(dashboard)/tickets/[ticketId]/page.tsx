"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  resolution: string | null;
  comments: Array<{ id: string; content: string; isInternal: boolean; createdAt: string }>;
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [resolution, setResolution] = useState("");

  const query = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => apiClient.get<TicketDetail>(`/api/v1/tickets/${ticketId}`) });

  function useAction(fn: () => Promise<unknown>) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
      onError: (err) => toast.push(err instanceof ApiError ? err.message : "Aksi gagal.", "error"),
    });
  }

  const addComment = useAction(() => apiClient.post(`/api/v1/tickets/${ticketId}/comments`, { content: comment, isInternal: true }));
  const resolveTicket = useAction(() => apiClient.post(`/api/v1/tickets/${ticketId}/resolve`, { resolution }));
  const closeTicket = useAction(() => apiClient.post(`/api/v1/tickets/${ticketId}/close`));
  const reopenTicket = useAction(() => apiClient.post(`/api/v1/tickets/${ticketId}/reopen`));

  if (!query.data) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat…</div>;
  const ticket = query.data;

  return (
    <>
      <Topbar title={`Ticket ${ticket.ticketNumber}`} />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{ticket.subject}</CardTitle>
            <Badge tone="gold">{ticket.status}</Badge>
          </CardHeader>
          <p className="mb-3 text-sm text-zinc-400">{ticket.description}</p>
          <div className="flex gap-2 text-xs text-zinc-500">
            <Badge>{ticket.category}</Badge>
            <Badge>{ticket.priority}</Badge>
          </div>
          <div className="mt-4 flex gap-2">
            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <>
                <Textarea placeholder="Resolusi…" value={resolution} onChange={(e) => setResolution(e.target.value)} className="min-h-[40px]" />
                <Button onClick={() => resolveTicket.mutate()} disabled={!resolution.trim()}>
                  Resolve
                </Button>
              </>
            )}
            {ticket.status === "RESOLVED" && <Button variant="secondary" onClick={() => closeTicket.mutate()}>Close</Button>}
            {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
              <Button variant="secondary" onClick={() => reopenTicket.mutate()}>
                Reopen
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Komentar Internal</CardTitle>
          </CardHeader>
          <div className="mb-3 space-y-2">
            {ticket.comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-zinc-300">
                {c.content}
                <div className="mt-1 text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleString("id-ID")}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tambahkan komentar…" className="min-h-[50px]" />
            <Button
              onClick={() => {
                addComment.mutate();
                setComment("");
              }}
              disabled={!comment.trim()}
            >
              Kirim
            </Button>
          </div>
        </Card>
      </main>
    </>
  );
}
