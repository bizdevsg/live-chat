"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useConversationRealtimeStore } from "@/lib/conversation-realtime-store";
import { getDashboardSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea, Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Permission } from "@/lib/permissions";
import type { ConversationDetail, MessageItem, MessageReceiptItem } from "@/lib/types";

function hasReceipt(message: Pick<MessageItem, "receipts">, readerType: string, readerId?: string | null) {
  return (
    message.receipts?.some((receipt) => receipt.readerType === readerType && (readerId === undefined || receipt.readerId === readerId)) ?? false
  );
}

function isIncomingCustomerMessage(message: Pick<MessageItem, "senderType">) {
  return message.senderType === "VISITOR" || message.senderType === "CUSTOMER";
}

function hasCustomerSeenMessage(message: Pick<MessageItem, "receipts">) {
  return hasReceipt(message, "VISITOR") || hasReceipt(message, "CUSTOMER");
}

function appendRealtimeMessage(detail: ConversationDetail | undefined, message: MessageItem) {
  if (!detail) return detail;
  if (detail.messages.some((item) => item.id === message.id)) return detail;

  return {
    ...detail,
    conversation: {
      ...detail.conversation,
      lastMessageAt: message.createdAt,
    },
    messages: [...detail.messages, message],
  };
}

function applyRealtimeReceipt(
  detail: ConversationDetail | undefined,
  payload: { messageId: string; readBy?: string; readerId?: string | null },
) {
  if (!detail || !payload.readBy) return detail;
  const readBy = payload.readBy;

  return {
    ...detail,
    messages: detail.messages.map((message) => {
      if (message.id !== payload.messageId) return message;
      if (hasReceipt(message, readBy, payload.readerId)) return message;

      const nextReceipt: MessageReceiptItem = {
        id: `${payload.messageId}:${readBy}:${payload.readerId ?? "unknown"}`,
        readerType: readBy,
        readerId: payload.readerId ?? null,
        readAt: new Date().toISOString(),
      };

      return {
        ...message,
        receipts: [...(message.receipts ?? []), nextReceipt],
      };
    }),
  };
}

function MessageBubble({ message, showSeen }: { message: MessageItem; showSeen?: boolean }) {
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
      <div className="max-w-md">
        <div
          className={`rounded-2xl px-4 py-2 text-sm ${
            mine ? "bg-gold-500 text-ink-900" : isAi ? "border border-blue-800 bg-blue-950 text-blue-100" : "bg-ink-700 text-zinc-100"
          }`}
        >
          <div className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">{message.senderType}</div>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
        {mine && showSeen && <div className="mt-1 text-right text-[11px] text-zinc-500">Seen</div>}
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
  const setActiveConversation = useConversationRealtimeStore((s) => s.setActiveConversation);
  const markUnread = useConversationRealtimeStore((s) => s.markUnread);
  const clearUnread = useConversationRealtimeStore((s) => s.clearUnread);
  const [isHydrated, setIsHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentReadMessageIdsRef = useRef(new Set<string>());

  const detailQuery = useQuery({
    queryKey: ["agent", "conversation", conversationId],
    queryFn: () => apiClient.get<ConversationDetail>(`/api/v1/agent/conversations/${conversationId}`),
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    agentReadMessageIdsRef.current.clear();
    setVisitorTyping(false);
    setAiTyping(false);
    setActiveConversation(conversationId);
    clearUnread(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, clearUnread, setActiveConversation]);

  useEffect(() => {
    const socket = getDashboardSocket();
    const joinConversation = () => {
      socket.emit("conversation:join", { conversationId });
    };
    const refetch = () => queryClient.invalidateQueries({ queryKey: ["agent", "conversation", conversationId] });
    const refetchIfCurrentConversation = (payload?: { conversationId?: string }) => {
      if (!payload?.conversationId || payload.conversationId === conversationId) {
        refetch();
      }
    };
    const markMessageRead = (message: MessageItem) => {
      if (!isIncomingCustomerMessage(message)) return;
      if (hasReceipt(message, "AGENT", user?.userId)) return;
      if (agentReadMessageIdsRef.current.has(message.id)) return;

      agentReadMessageIdsRef.current.add(message.id);
      socket.emit("message:read", { messageId: message.id });
    };
    const handleMessageCreated = (payload?: { conversationId?: string; message?: MessageItem }) => {
      if (!payload?.conversationId || payload.conversationId !== conversationId || !payload.message) return;

      queryClient.setQueryData<ConversationDetail | undefined>(
        ["agent", "conversation", conversationId],
        (current) => appendRealtimeMessage(current, payload.message!),
      );

      if (payload.message.senderType === "AI") setAiTyping(false);
      if (payload.message.senderType === "VISITOR" || payload.message.senderType === "CUSTOMER") {
        setVisitorTyping(false);
        if (document.visibilityState === "visible" && document.hasFocus()) {
          clearUnread(conversationId);
          markMessageRead(payload.message);
        } else {
          markUnread(conversationId);
        }
      }
    };
    const handleMessageUpdated = (payload?: { conversationId?: string; messageId?: string; readBy?: string; readerId?: string | null }) => {
      if (!payload?.messageId) return;
      if (payload.conversationId && payload.conversationId !== conversationId) return;
      if (payload.readBy === "AGENT") {
        agentReadMessageIdsRef.current.add(payload.messageId);
        clearUnread(conversationId);
      }

      queryClient.setQueryData<ConversationDetail | undefined>(
        ["agent", "conversation", conversationId],
        (current) => applyRealtimeReceipt(current, { messageId: payload.messageId!, readBy: payload.readBy, readerId: payload.readerId }),
      );
    };
    const handleTypingUpdated = (payload?: { from?: string; typing?: boolean }) => {
      if (!payload?.from) return;
      if (payload.from === "VISITOR") setVisitorTyping(!!payload.typing);
      if (payload.from === "AI") setAiTyping(!!payload.typing);
    };

    if (socket.connected) joinConversation();
    socket.on("connect", joinConversation);
    socket.on("message:created", handleMessageCreated);
    socket.on("message:updated", handleMessageUpdated);
    socket.on("typing:updated", handleTypingUpdated);
    socket.on("conversation:updated", refetchIfCurrentConversation);
    socket.on("conversation:assigned", refetchIfCurrentConversation);

    return () => {
      if (socket.connected) {
        socket.emit("conversation:leave", { conversationId });
      }
      socket.off("connect", joinConversation);
      socket.off("message:created", handleMessageCreated);
      socket.off("message:updated", handleMessageUpdated);
      socket.off("typing:updated", handleTypingUpdated);
      socket.off("conversation:updated", refetchIfCurrentConversation);
      socket.off("conversation:assigned", refetchIfCurrentConversation);
    };
  }, [conversationId, clearUnread, markUnread, queryClient, user?.userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detailQuery.data?.messages.length]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      getDashboardSocket().emit("typing:stop", { conversationId });
    };
  }, [conversationId]);

  const visibleMessages = useMemo(() => detailQuery.data?.messages ?? [], [detailQuery.data]);
  const lastSeenAgentMessageId = useMemo(() => {
    const latestOwnMessage = [...visibleMessages].reverse().find((message) => message.senderType === "AGENT" && !message.isInternal);
    if (!latestOwnMessage || !hasCustomerSeenMessage(latestOwnMessage)) return null;
    return latestOwnMessage.id;
  }, [visibleMessages]);

  useEffect(() => {
    const markVisibleMessagesAsRead = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;

      const socket = getDashboardSocket();
      const unreadIncomingMessages = visibleMessages.filter((message) => isIncomingCustomerMessage(message) && !hasReceipt(message, "AGENT", user?.userId));
      if (unreadIncomingMessages.length === 0) return;

      clearUnread(conversationId);
      for (const message of unreadIncomingMessages) {
        if (agentReadMessageIdsRef.current.has(message.id)) continue;
        agentReadMessageIdsRef.current.add(message.id);
        socket.emit("message:read", { messageId: message.id });
      }
    };

    markVisibleMessagesAsRead();
    window.addEventListener("focus", markVisibleMessagesAsRead);
    document.addEventListener("visibilitychange", markVisibleMessagesAsRead);
    return () => {
      window.removeEventListener("focus", markVisibleMessagesAsRead);
      document.removeEventListener("visibilitychange", markVisibleMessagesAsRead);
    };
  }, [clearUnread, conversationId, user?.userId, visibleMessages]);

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
  const suggestedReply = useMutation({
    mutationFn: () => apiClient.post<{ reply: string }>(`/api/v1/agent/conversations/${conversationId}/suggested-reply`),
    onSuccess: ({ reply }) => {
      setDraft(reply);
      toast.push("Suggested reply sudah dimasukkan ke kolom balasan.", "success");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat suggested reply.", "error"),
  });
  const refreshSummary = useActionMutation(`/api/v1/agent/conversations/${conversationId}/summary`);
  const createTicket = useMutation({
    mutationFn: (body: { subject: string; description: string; category: string }) =>
      apiClient.post("/api/v1/tickets", { ...body, conversationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.push("Ticket berhasil dibuat.", "success");
      setTicketOpen(false);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat ticket.", "error"),
  });

  if (detailQuery.isLoading) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat conversation...</div>;
  if (!detailQuery.data) return <div className="flex-1 p-6 text-sm text-red-400">Conversation tidak ditemukan.</div>;

  const { conversation, summary, recentAiRuns } = detailQuery.data;
  const customerDisplayName = conversation.customer?.name ?? conversation.leads?.[0]?.name ?? "Visitor anonim";
  const isMine = isHydrated && conversation.assignedAgentId === user?.userId;
  const isQueued =
    conversation.status === "QUEUED" ||
    conversation.status === "WAITING_AGENT" ||
    (conversation.status === "AI_ACTIVE" && !conversation.assignedAgentId);
  const isAiHandled = conversation.handlerType === "AI";
  const isResolved = conversation.status === "RESOLVED";
  const isClosed = conversation.status === "CLOSED";
  const isInactive = isResolved || isClosed;
  const canReply = isMine && conversation.handlerType === "HUMAN" && !isInactive;
  const replyHint = isQueued && !conversation.assignedAgentId
    ? "Accept chat ini dulu sebelum membalas."
    : !isMine && conversation.assignedAgentId
      ? "Chat ini sedang ditangani agent lain."
      : isResolved
        ? "Conversation ini sudah ditutup. Reopen dulu kalau mau membalas lagi."
        : isClosed
          ? "Conversation ini sudah di-close dan tidak bisa dibuka lagi."
        : "Chat ini harus diambil dulu sebelum bisa dibalas.";

  function stopAgentTyping() {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
    getDashboardSocket().emit("typing:stop", { conversationId });
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!canReply) return;

    if (!value.trim()) {
      stopAgentTyping();
      return;
    }

    const wasTyping = typingStopTimerRef.current !== null;
    if (!wasTyping) getDashboardSocket().emit("typing:start", { conversationId });
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      getDashboardSocket().emit("typing:stop", { conversationId });
      typingStopTimerRef.current = null;
    }, 1500);
  }

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
            {isHydrated && isQueued && !conversation.assignedAgentId && (
              <Button size="sm" onClick={() => accept.mutate(undefined)}>
                Accept
              </Button>
            )}
            {isHydrated && isAiHandled && hasPermission(Permission.CONVERSATION_TAKEOVER) && (
              <Button size="sm" variant="secondary" onClick={() => takeover.mutate(undefined)}>
                Take Over
              </Button>
            )}
            {isMine && !isAiHandled && (
              <Button size="sm" variant="secondary" onClick={() => returnToAi.mutate(undefined)}>
                Return to AI
              </Button>
            )}
            {isHydrated && hasPermission(Permission.CONVERSATION_TRANSFER) && (
              <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                Transfer
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setTicketOpen(true)}>
              Buat Ticket
            </Button>
            {!isInactive ? (
              <Button size="sm" variant="danger" onClick={() => resolve.mutate(undefined)}>
                Resolve
              </Button>
            ) : isResolved ? (
              <Button size="sm" variant="secondary" onClick={() => reopen.mutate(undefined)}>
                Reopen
              </Button>
            ) : null}
          </div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-6">
          {visibleMessages.map((m) => (
            <MessageBubble key={m.id} message={m} showSeen={m.id === lastSeenAgentMessageId} />
          ))}
          {(visitorTyping || aiTyping) && (
            <div className="text-xs text-zinc-500">
              {visitorTyping ? "Visitor sedang mengetik…" : "AI sedang mengetik…"}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-ink-600 p-4">
          {!canReply && <div className="mb-3 rounded-xl border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">{replyHint}</div>}
          <div className="mb-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => suggestedReply.mutate()} disabled={!canReply || suggestedReply.isPending}>
              {suggestedReply.isPending ? "Menyusun..." : "Suggested Reply"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              placeholder={canReply ? "Tulis balasan..." : "Accept chat dulu sebelum membalas..."}
              className="min-h-[60px]"
              disabled={!canReply}
              onKeyDown={(e) => {
                if (!canReply) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    sendMessage.mutate({ content: draft, clientMessageId: crypto.randomUUID() });
                    setDraft("");
                    stopAgentTyping();
                  }
                }
              }}
            />
            <Button
              disabled={!canReply}
              onClick={() => {
                if (!canReply || !draft.trim()) return;
                sendMessage.mutate({ content: draft, clientMessageId: crypto.randomUUID() });
                setDraft("");
                stopAgentTyping();
              }}
            >
              Kirim
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={canReply ? "Internal note (tidak terlihat customer)..." : "Accept chat dulu sebelum menambah catatan..."}
              disabled={!canReply}
            />
            <Button
              variant="secondary"
              disabled={!canReply}
              onClick={() => {
                if (!canReply || !note.trim()) return;
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
        <p className="mb-1 text-sm text-zinc-300">{customerDisplayName}</p>
        <p className="mb-4 text-xs text-zinc-500">{conversation.customer?.email ?? conversation.leads?.[0]?.email ?? "-"}</p>

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
            <p className="text-sm text-gold-500">{"*".repeat(conversation.ratingScore)}</p>
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
        <option value="">- Pilih tim -</option>
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
