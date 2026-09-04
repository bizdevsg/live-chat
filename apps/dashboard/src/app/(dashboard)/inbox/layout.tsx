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
import { AutoReturnCountdown } from "@/components/inbox/auto-return-countdown";

type Tab = "waiting" | "mine";

/** A visitor asked for a human (or the AI handed off) and no agent has picked it up yet. */
const WAITING_FOR_AGENT = new Set(["QUEUED", "WAITING_AGENT"]);
const ONGOING_STATUSES = new Set(["AI_ACTIVE", "QUEUED", "WAITING_AGENT", "AGENT_ACTIVE"]);

function getWaitingRank(status: string) {
  if (WAITING_FOR_AGENT.has(status)) return 0;
  if (status === "AI_ACTIVE") return 1;
  if (status === "RESOLVED" || status === "CLOSED") return 2;
  return 3;
}

const STATUS_META: Record<string, { label: string; tone: "green" | "amber" | "gold" | "blue" | "red" }> = {
  QUEUED: { label: "Sedang Menunggu Agent", tone: "amber" },
  WAITING_AGENT: { label: "Sedang Menunggu Agent", tone: "amber" },
  AGENT_ACTIVE: { label: "Ditangani Agent", tone: "green" },
  AI_ACTIVE: { label: "AI Aktif", tone: "blue" },
  RESOLVED: { label: "Selesai", tone: "green" },
  CLOSED: { label: "Ditutup", tone: "red" },
};

function StatusBadge({ status, assignedAgentId, handlerType }: { status: string; assignedAgentId?: string | null; handlerType?: string | null }) {
  if (status === "RESOLVED") {
    const resolvedLabel = assignedAgentId ? "Selesai Agent" : handlerType === "AI" ? "Selesai AI" : "Selesai";
    return <Badge tone="green">{resolvedLabel}</Badge>;
  }

  const meta = STATUS_META[status] ?? { label: status, tone: "gold" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
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

  // Socket `queue:updated` is the fast path; this poll is the fallback for when the realtime
  // connection is down (e.g. a dropped tunnel). refetchIntervalInBackground keeps it running
  // when the agent has the inbox open in an unfocused tab.
  const waitingQuery = useQuery({
    queryKey: ["agent", "queue"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/queue"),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const mineQuery = useQuery({
    queryKey: ["agent", "conversations", "mine"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/conversations"),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
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

  const rawList = tab === "waiting" ? (waitingQuery.data ?? []) : (mineQuery.data ?? []);
  // In the Waiting tab, float conversations that need a human to the top (server order —
  // lastMessageAt desc — is preserved within each group since Array.sort is stable).
  const list =
    tab === "waiting"
      ? [...rawList].sort(
          (a, b) => getWaitingRank(a.status) - getWaitingRank(b.status),
        )
      : rawList;
  const tabCounts = {
    waiting: waitingQuery.data?.filter((conversation) => ONGOING_STATUSES.has(conversation.status)).length ?? 0,
    mine: mineQuery.data?.length ?? 0,
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className="flex max-h-[42vh] min-h-[240px] w-full min-w-0 flex-col border-b border-ink-600 bg-ink-800/40 md:max-h-none md:min-h-0 md:w-72 md:shrink-0 md:border-b-0 md:border-r"
      >
        <div className="flex border-b border-ink-600 text-xs">
          {(["waiting", "mine"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 py-3 font-medium uppercase tracking-wide", tab === t ? "border-b-2 border-gold-500 text-gold-500" : "text-zinc-500")}
            >
              <span className="inline-flex items-center gap-2">
                <span>{t === "waiting" ? "Waiting" : "My Chats"}</span>
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
                      <StatusBadge status={c.status} assignedAgentId={c.assignedAgentId} handlerType={c.handlerType} />
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                    <span className="truncate">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString("id-ID") : "-"}</span>
                    <AutoReturnCountdown deadlineAt={c.agentReplyDeadlineAt} compact />
                  </div>
                </Link>
              );
            })()
          ))}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">{children}</div>
    </div>
  );
}
