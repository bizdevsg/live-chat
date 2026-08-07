"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getDashboardSocket } from "@/lib/socket";
import type { ConversationSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

type Tab = "waiting" | "mine" | "resolved";

function StatusBadge({ status }: { status: string }) {
  const tone = status === "RESOLVED" || status === "CLOSED" ? "green" : status === "QUEUED" || status === "WAITING_AGENT" ? "amber" : "gold";
  return <Badge tone={tone}>{status}</Badge>;
}

export default function InboxLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const [tab, setTab] = useState<Tab>("waiting");
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ["agent", "queue"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/queue"),
    enabled: tab === "waiting",
    refetchInterval: 15000,
  });

  const mine = useQuery({
    queryKey: ["agent", "conversations", tab],
    queryFn: () =>
      apiClient.get<ConversationSummary[]>(`/api/v1/agent/conversations${tab === "resolved" ? "?status=RESOLVED" : ""}`),
    enabled: tab !== "waiting",
    refetchInterval: 15000,
  });

  useEffect(() => {
    const socket = getDashboardSocket();
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["agent", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] });
    };
    socket.on("queue:updated", invalidate);
    socket.on("conversation:assigned", invalidate);
    socket.on("conversation:updated", invalidate);
    return () => {
      socket.off("queue:updated", invalidate);
      socket.off("conversation:assigned", invalidate);
      socket.off("conversation:updated", invalidate);
    };
  }, [queryClient]);

  const list = tab === "waiting" ? (queue.data ?? []) : (mine.data ?? []);

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
              {t === "waiting" ? "Waiting" : t === "mine" ? "My Chats" : "Resolved"}
            </button>
          ))}
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {list.length === 0 && <p className="p-4 text-center text-xs text-zinc-600">Tidak ada conversation.</p>}
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/inbox/${c.id}`}
              className={cn(
                "block border-b border-ink-700 px-4 py-3 hover:bg-ink-700",
                params?.conversationId === c.id && "bg-ink-700",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-zinc-500">{c.context?.pageTitle ?? "Chat"}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="text-sm text-zinc-300">{c.intent ?? "Belum diklasifikasi"}</div>
              <div className="mt-1 text-[11px] text-zinc-600">
                {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString("id-ID") : "-"}
              </div>
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
