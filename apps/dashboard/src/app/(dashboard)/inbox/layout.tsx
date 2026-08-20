"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useConversationRealtimeStore } from "@/lib/conversation-realtime-store";
import { getDashboardSocket } from "@/lib/socket";
import type { ConversationSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

type Tab = "waiting" | "mine" | "resolved";

function StatusBadge({ status }: { status: string }) {
  const tone = status === "RESOLVED" || status === "CLOSED" ? "green" : status === "QUEUED" || status === "WAITING_AGENT" ? "amber" : "gold";
  return <Badge tone={tone}>{status}</Badge>;
}

function ConversationNotificationBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      Baru
    </span>
  );
}

export default function InboxLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const [tab, setTab] = useState<Tab>("waiting");
  const queryClient = useQueryClient();
  const unreadByConversationId = useConversationRealtimeStore((s) => s.unreadByConversationId);
  const activeConversationId = useConversationRealtimeStore((s) => s.activeConversationId);

  const waitingQuery = useQuery({
    queryKey: ["agent", "queue"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/queue"),
    refetchInterval: 15000,
  });

  const mineQuery = useQuery({
    queryKey: ["agent", "conversations", "mine"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/conversations"),
    refetchInterval: 15000,
  });

  const resolvedQuery = useQuery({
    queryKey: ["agent", "conversations", "resolved"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/conversations?status=RESOLVED"),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const socket = getDashboardSocket();
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["agent", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] });
    };
    socket.on("queue:updated", invalidate);
    socket.on("message:created", invalidate);
    socket.on("message:updated", invalidate);
    socket.on("conversation:assigned", invalidate);
    socket.on("conversation:updated", invalidate);
    socket.on("notification:new", invalidate);
    return () => {
      socket.off("queue:updated", invalidate);
      socket.off("message:created", invalidate);
      socket.off("message:updated", invalidate);
      socket.off("conversation:assigned", invalidate);
      socket.off("conversation:updated", invalidate);
      socket.off("notification:new", invalidate);
    };
  }, [queryClient]);

  const list = tab === "waiting" ? (waitingQuery.data ?? []) : tab === "mine" ? (mineQuery.data ?? []) : (resolvedQuery.data ?? []);
  const tabCounts = {
    waiting: waitingQuery.data?.length ?? 0,
    mine: mineQuery.data?.length ?? 0,
    resolved: resolvedQuery.data?.length ?? 0,
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-72 shrink-0 flex-col border-r border-ink-600 bg-ink-800/40">
        <div className="flex border-b border-ink-600 text-xs">
          {(["waiting", "mine", "resolved"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 py-3 font-medium uppercase tracking-wide", tab === t ? "border-b-2 border-gold-500 text-gold-500" : "text-zinc-500")}
            >
              <span className="inline-flex items-center gap-2">
                <span>{t === "waiting" ? "Waiting" : t === "mine" ? "My Chats" : "Resolved"}</span>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] leading-none", tab === t ? "bg-gold-500/20 text-gold-500" : "bg-zinc-800 text-zinc-400")}>
                  {tabCounts[t]}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {list.length === 0 && <p className="p-4 text-center text-xs text-zinc-600">Tidak ada conversation.</p>}
          {list.map((c) => (
            (() => {
              const customerName = c.customer?.name ?? c.leads?.[0]?.name ?? c.context?.pageTitle ?? "Visitor anonim";
              const subtitle = c.intent ?? c.context?.pageTitle ?? "Belum diklasifikasi";
              const latestMessage = c.messages?.[0];
              const hasUnreadFromServer =
                !!latestMessage &&
                ["VISITOR", "CUSTOMER"].includes(latestMessage.senderType) &&
                (latestMessage.receipts?.length ?? 0) === 0;
              const hasUnreadFromSession = !!unreadByConversationId[c.id] && activeConversationId !== c.id;
              const hasUnreadCustomerMessage = hasUnreadFromServer || hasUnreadFromSession;

              return (
                <Link
                  key={c.id}
                  href={`/inbox/${c.id}`}
                  className={cn(
                    "block border-b border-ink-700 px-4 py-3 hover:bg-ink-700",
                    params?.conversationId === c.id && "bg-ink-700",
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-200">{customerName}</div>
                      <div className="truncate text-xs text-zinc-500">{subtitle}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ConversationNotificationBadge show={hasUnreadCustomerMessage} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-600">
                    {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString("id-ID") : "-"}
                  </div>
                </Link>
              );
            })()
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
