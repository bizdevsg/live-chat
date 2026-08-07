"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { getDashboardSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea, Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Permission } from "@solidchat/shared";
import type { ConversationDetail, MessageItem } from "@/lib/types";

function MessageBubble({ message }: { message: MessageItem }) {
  const mine = message.senderType === "AGENT";
  const isAi = message.senderType === "AI";
  const isSuggestion = message.messageType === "AI_SUGGESTION";
  const isNote = message.messageType === "INTERNAL_NOTE";

  if (isNote) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
        <span className="font-semibold">Internal note:</span> {message.content}
      </div>
    );
  }
  if (isSuggestion) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-blue-700/40 bg-blue-900/20 px-3 py-2 text-xs text-blue-300">
        <span className="font-semibold">AI Suggested Reply:</span> {message.content}
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-md rounded-2xl px-4 py-2 text-sm ${
          mine ? "bg-gold-500 text-ink-900" : isAi ? "bg-blue-950 text-blue-100 border border-blue-800" : "bg-ink-700 text-zinc-100"
        }`}
      >
        <div className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">{message.senderType}</div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

export default function ConversationDetailPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const detailQuery = useQuery({
    queryKey: ["agent", "conversation", conversationId],
    queryFn: () => apiClient.get<ConversationDetail>(`/api/v1/agent/conversations/${conversationId}`),
  });

  useEffect(() => {
    const socket = getDashboardSocket();
    socket.emit("conversation:join", { conversationId });
    const refetch = () => queryClient.invalidateQueries({ queryKey: ["agent", "conversation", conversationId] });
    socket.on("message:created", refetch);
    socket.on("conversation:updated", refetch);
    socket.on("conversation:assigned", refetch);
    return () => {
      socket.emit("conversation:leave", { conversationId });
      socket.off("message:created", refetch);
      socket.off("conversation:updated", refetch);
      socket.off("conversation:assigned", refetch);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detailQuery.data?.messages.length]);

  const visibleMessages = useMemo(() => detailQuery.data?.messages ?? [], [detailQuery.data]);

  function useActionMutation(path: string, method: "post" = "post") {
    return useMutation({
      mutationFn: (body?: unknown) => apiClient[method]<unknown>(path, body),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent", "conversation", conversationId] }),
      onError: (err) => toast.push(err instanceof ApiError ? err.message : "Aksi gagal.", "error"),
    });
  }

  const sendMessage = useActionMutation(`/api/v1/agent/conversations/${conversationId}/messages`);
  const sendNote = useActionMutation(`/api/v1/agent/conversations/${conversationId}/internal-notes`);
  const accept = useActionMutation(`/api/v1/agent/conversations/${conversationId}/accept`);
  const takeover = useActionMutation(`/api/v1/agent/conversations/${conversationId}/takeover`);
  const returnToAi = useActionMutation(`/api/v1/agent/conversations/${conversationId}/return-to-ai`);
  const resolve = useActionMutation(`/api/v1/agent/conversations/${conversationId}/resolve`);
  const reopen = useActionMutation(`/api/v1/agent/conversations/${conversationId}/reopen`);
  const transfer = useActionMutation(`/api/v1/agent/conversations/${conversationId}/transfer`);
  const suggestedReply = useActionMutation(`/api/v1/agent/conversations/${conversationId}/suggested-reply`);
  const refreshSummary = useActionMutation(`/api/v1/agent/conversations/${conversationId}/summary`);
  const createTicket = useMutation({
    mutationFn: (body: { subject: string; description: string; category: string }) =>
      apiClient.post("/api/v1/tickets", { ...body, conversationId }),
    onSuccess: () => {
      toast.push("Ticket berhasil dibuat.", "success");
      setTicketOpen(false);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat ticket.", "error"),
  });

  if (detailQuery.isLoading) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat conversation…</div>;
  if (!detailQuery.data) return <div className="flex-1 p-6 text-sm text-red-400">Conversation tidak ditemukan.</div>;

  const { conversation, summary, recentAiRuns } = detailQuery.data;
  const isMine = conversation.assignedAgentId === user?.userId;
  const isQueued = conversation.status === "QUEUED" || conversation.status === "WAITING_AGENT";
  const isAiHandled = conversation.handlerType === "AI";
  const isResolved = conversation.status === "RESOLVED" || conversation.status === "CLOSED";

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-600 px-6 py-3">
          <div className="flex items-center gap-2">
            <Badge tone="gold">{conversation.status}</Badge>
            <Badge tone={conversation.handlerType === "AI" ? "blue" : "green"}>{conversation.handlerType}</Badge>
            {conversation.intent && <Badge>{conversation.intent}</Badge>}
          </div>
          <div className="flex gap-2">
            {isQueued && !conversation.assignedAgentId && (
              <Button size="sm" onClick={() => accept.mutate(undefined)}>
                Accept
              </Button>
            )}
            {isAiHandled && hasPermission(Permission.CONVERSATION_TAKEOVER) && (
              <Button size="sm" variant="secondary" onClick={() => takeover.mutate(undefined)}>
                Take Over
              </Button>
            )}
            {isMine && !isAiHandled && (
              <Button size="sm" variant="secondary" onClick={() => returnToAi.mutate(undefined)}>
                Return to AI
              </Button>
            )}
            {hasPermission(Permission.CONVERSATION_TRANSFER) && (
              <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                Transfer
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setTicketOpen(true)}>
              Buat Ticket
            </Button>
            {!isResolved ? (
              <Button size="sm" variant="danger" onClick={() => resolve.mutate(undefined)}>
                Resolve
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => reopen.mutate(undefined)}>
                Reopen
              </Button>
            )}
          </div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-6">
          {visibleMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-ink-600 p-4">
          <div className="mb-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => suggestedReply.mutate(undefined)} disabled={suggestedReply.isPending}>
              ✨ Suggested Reply
            </Button>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tulis balasan…"
              className="min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    sendMessage.mutate({ content: draft, clientMessageId: crypto.randomUUID() });
                    setDraft("");
                  }
                }
              }}
            />
            <Button
              onClick={() => {
                if (!draft.trim()) return;
                sendMessage.mutate({ content: draft, clientMessageId: crypto.randomUUID() });
                setDraft("");
              }}
            >
              Kirim
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (tidak terlihat customer)…" />
            <Button
              variant="secondary"
              onClick={() => {
                if (!note.trim()) return;
                sendNote.mutate({ content: note });
                setNote("");
              }}
            >
              Catat
            </Button>
          </div>
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-ink-600 bg-ink-800/40 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Customer</h3>
        <p className="mb-4 text-sm text-zinc-300">{conversation.customer?.name ?? "Visitor anonim"}</p>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Halaman Sumber</h3>
        <p className="mb-4 truncate text-xs text-zinc-500">{conversation.context?.pageUrl ?? "-"}</p>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Alasan Handoff</h3>
        <p className="mb-4 text-xs text-zinc-400">{conversation.handoffReason ?? "-"}</p>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ringkasan AI</h3>
          <button className="text-[10px] text-gold-500 hover:underline" onClick={() => refreshSummary.mutate(undefined)}>
            Refresh
          </button>
        </div>
        {summary ? (
          <div className="mb-4 space-y-2 text-xs text-zinc-400">
            <p>{summary.customerGoal}</p>
            {summary.openIssues.length > 0 && (
              <ul className="list-disc pl-4">
                {summary.openIssues.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mb-4 text-xs text-zinc-600">Belum ada ringkasan.</p>
        )}

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">AI Runs Terakhir</h3>
        <div className="space-y-1 text-xs text-zinc-500">
          {recentAiRuns.map((run) => (
            <div key={run.id} className="flex justify-between">
              <span>{run.purpose}</span>
              <span>{run.confidence != null ? `${Math.round(run.confidence * 100)}%` : "-"}</span>
            </div>
          ))}
        </div>

        {conversation.ratingScore && (
          <>
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Rating Customer</h3>
            <p className="text-sm text-gold-500">{"★".repeat(conversation.ratingScore)}</p>
          </>
        )}
      </aside>

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransfer={(toTeamId) => transfer.mutate({ toTeamId })}
      />
      <Modal open={ticketOpen} title="Buat Ticket" onClose={() => setTicketOpen(false)}>
        <TicketForm onSubmit={(v) => createTicket.mutate(v)} pending={createTicket.isPending} />
      </Modal>
    </>
  );
}

function TransferModal({ open, onClose, onTransfer }: { open: boolean; onClose: () => void; onTransfer: (teamId: string) => void }) {
  const teamsQuery = useQuery({
    queryKey: ["admin", "teams"],
    queryFn: () => apiClient.get<Array<{ id: string; name: string }>>("/api/v1/admin/teams"),
    enabled: open,
  });
  const [teamId, setTeamId] = useState("");

  return (
    <Modal open={open} title="Transfer Conversation" onClose={onClose}>
      <Label htmlFor="team">Pilih Tim</Label>
      <Select id="team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">— Pilih tim —</option>
        {teamsQuery.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button
          disabled={!teamId}
          onClick={() => {
            onTransfer(teamId);
            onClose();
          }}
        >
          Transfer
        </Button>
      </div>
    </Modal>
  );
}

function TicketForm({ onSubmit, pending }: { onSubmit: (v: { subject: string; description: string; category: string }) => void; pending: boolean }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ subject, description, category });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="subject">Subjek</Label>
        <Input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="category">Kategori</Label>
        <Input id="category" required value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea id="description" required value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          Buat Ticket
        </Button>
      </div>
    </form>
  );
}
