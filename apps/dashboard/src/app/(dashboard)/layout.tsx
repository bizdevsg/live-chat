"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isUnauthorized, useMe } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useConversationRealtimeStore } from "@/lib/conversation-realtime-store";
import { playNotificationSoundForType, prepareNotificationSounds } from "@/lib/notification-sounds";
import { showBrowserNotification } from "@/lib/browser-notifications";
import { DashboardShellProvider } from "@/components/layout/dashboard-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { getDashboardSocket, disconnectDashboardSocket } from "@/lib/socket";
import type { ConversationDetail, ConversationSummary } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading, isError, error, refetch } = useMe();
  const status = useAuthStore((s) => s.status);
  const accountSettings = useAuthStore((s) => s.user?.accountSettings);
  const activeConversationId = useConversationRealtimeStore((s) => s.activeConversationId);
  const markUnread = useConversationRealtimeStore((s) => s.markUnread);
  const clearUnread = useConversationRealtimeStore((s) => s.clearUnread);
  const resetConversationRealtime = useConversationRealtimeStore((s) => s.reset);
  const toast = useToast();

  useEffect(() => {
    if (isError && isUnauthorized(error)) router.replace("/login");
  }, [error, isError, router]);

  useEffect(() => {
    prepareNotificationSounds(accountSettings);
  }, [accountSettings]);

  useEffect(() => {
    if (status !== "authenticated") {
      disconnectDashboardSocket();
      resetConversationRealtime();
      return;
    }

    const socket = getDashboardSocket();
    if (!socket.connected) socket.connect();

    const shouldSuppressNewConversationNotification = (conversationId: string) => {
      const detail = queryClient.getQueryData<ConversationDetail>(["agent", "conversation", conversationId]);
      const detailConversation = detail?.conversation;
      if (detailConversation) {
        return !!detailConversation.assignedAgentId || detailConversation.handlerType === "HUMAN" || detailConversation.status === "AGENT_ACTIVE";
      }

      const conversationLists = queryClient.getQueriesData<ConversationSummary[]>({ queryKey: ["agent"] });
      for (const [, conversations] of conversationLists) {
        const conversation = conversations?.find((item) => item.id === conversationId);
        if (!conversation) continue;
        if (conversation.assignedAgentId || conversation.handlerType === "HUMAN" || conversation.status === "AGENT_ACTIVE") {
          return true;
        }
      }

      return false;
    };

    const handleNotification = (payload: { type?: string; title?: string; body?: string; conversationId?: string }) => {
      const isRealtimeConversationNotification =
        payload.type === "NEW_CUSTOMER_MESSAGE" ||
        payload.type === "NEW_WAITING_CONVERSATION" ||
        payload.type === "NEW_INBOX_CONVERSATION";
      const isOnConversationNotification = payload.type === "NEW_CUSTOMER_MESSAGE";
      const isNewConversationNotification = payload.type === "NEW_WAITING_CONVERSATION" || payload.type === "NEW_INBOX_CONVERSATION";
      const isActivelyViewedConversation =
        !!payload.conversationId &&
        payload.conversationId === activeConversationId &&
        document.visibilityState === "visible" &&
        document.hasFocus();

      if (payload.conversationId && isNewConversationNotification && shouldSuppressNewConversationNotification(payload.conversationId)) {
        clearUnread(payload.conversationId);
        return;
      }

      if (payload.conversationId && isRealtimeConversationNotification) {
        if (isActivelyViewedConversation) {
          clearUnread(payload.conversationId);
        } else {
          markUnread(payload.conversationId);
        }
      }

      if (isActivelyViewedConversation) {
        if (isOnConversationNotification) {
          playNotificationSoundForType(payload.type, accountSettings);
        }
        return;
      }

      if (payload.title) {
        toast.push(payload.body ? `${payload.title} - ${payload.body}` : payload.title, "info");
      }
      showBrowserNotification(payload);
      playNotificationSoundForType(payload.type, accountSettings);
    };

    socket.on("notification:new", handleNotification);
    return () => {
      socket.off("notification:new", handleNotification);
    };
  }, [status, accountSettings, activeConversationId, clearUnread, markUnread, queryClient, resetConversationRealtime, toast]);

  useEffect(() => {
    if (status !== "authenticated") return;
    return () => disconnectDashboardSocket();
  }, [status]);

  if (isLoading || status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Memuat sesi…
      </div>
    );
  }

  if (isError && !isUnauthorized(error)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_78%_0%,rgba(212,175,55,0.07),transparent_30rem),#101114] px-6">
        <div className="w-full max-w-md rounded-3xl border border-ink-600 bg-ink-800/80 p-6 text-center shadow-2xl">
          <h1 className="text-lg font-semibold text-white">Dashboard belum bisa dimuat</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Sesi Anda masih ada, tetapi koneksi ke API gagal saat refresh. Coba muat ulang data tanpa logout.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-gold px-4 py-2 text-sm font-medium text-ink"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") return null;

  return (
    <DashboardShellProvider>
      <div className="flex h-screen min-w-0 overflow-hidden bg-[radial-gradient(circle_at_78%_0%,rgba(212,175,55,0.07),transparent_30rem),#101114]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </DashboardShellProvider>
  );
}
