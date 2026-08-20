import { useEffect, useRef, useState } from "react";
import { useWidgetSession } from "./hooks/use-widget-session";
import { useConversation } from "./hooks/use-conversation";
import { listenToParent, sendToParent } from "./lib/postmessage";
import { api } from "./lib/api";
import { Header } from "./components/Header";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { RatingForm } from "./components/RatingForm";
import { PreChatForm, type PreChatValues } from "./components/PreChatForm";
import { widgetStorage } from "./lib/storage";

export default function App() {
  const { config, visitorToken, loading, error } = useWidgetSession();
  const {
    conversation,
    messages,
    connected,
    agentTyping,
    agentTypingName,
    aiTyping,
    agentConnecting,
    canRequestAgent,
    sendMessage,
    requestAgent,
    closeConversation,
    startNewConversation,
    submitFeedback,
    notifyTyping,
    loadConversation,
  } = useConversation(visitorToken, config?.siteId ?? null);
  const [leadConversationId, setLeadConversationId] = useState(() => widgetStorage.getLeadConversationId());

  async function handlePreChatSubmit(values: PreChatValues) {
    if (!conversation || !visitorToken) {
      throw new Error("Percakapan belum siap. Coba lagi sebentar.");
    }

    const response = await api.post<{ id: string; syncStatus: string; conversationId?: string | null; resumedConversation?: boolean }>(
      `/api/v1/widget/conversations/${conversation.id}/lead`,
      values,
      visitorToken,
    );
    const targetConversationId = response.conversationId ?? conversation.id;
    widgetStorage.setLeadConversationId(targetConversationId);
    setLeadConversationId(targetConversationId);
    if (targetConversationId !== conversation.id) {
      await loadConversation(targetConversationId);
    }
  }

  const [panelOpen, setPanelOpen] = useState(true);
  const readCountRef = useRef(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    sendToParent({ type: "solidchat:ready" });
    return listenToParent((msg) => {
      if (msg.type === "solidchat:identify" && visitorToken) {
        api.post("/api/v1/widget/identify", { identityToken: msg.identityToken }, visitorToken).catch(() => undefined);
      }
      if (msg.type === "solidchat:open") setPanelOpen(true);
      if (msg.type === "solidchat:close") setPanelOpen(false);
    });
  }, [visitorToken]);

  useEffect(() => {
    if (panelOpen) {
      readCountRef.current = messages.length;
      setUnreadCount(0);
      return;
    }
    const unseen = messages.filter((m, i) => i >= readCountRef.current && m.senderType !== "VISITOR" && m.senderType !== "CUSTOMER").length;
    setUnreadCount(unseen);
  }, [messages, panelOpen]);

  useEffect(() => {
    sendToParent({ type: "solidchat:unread", count: unreadCount });
  }, [unreadCount]);

  useEffect(() => {
    sendToParent({ type: "solidchat:resize", height: 560 });
  }, []);

  const [showRating, setShowRating] = useState(false);
  useEffect(() => {
    if (conversation?.status === "RESOLVED" || conversation?.status === "CLOSED") {
      if (config?.settings?.ratingFormEnabled) setShowRating(true);
    }
  }, [conversation?.status, config?.settings?.ratingFormEnabled]);

  const conversationEnded = conversation?.status === "RESOLVED" || conversation?.status === "CLOSED";
  const leadSubmittedForConversation = !!conversation && leadConversationId === conversation.id;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink text-sm text-zinc-500">Memuat SolidChat...</div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-6 text-center text-sm text-zinc-500">
        {error ?? "Widget tidak tersedia saat ini."}
      </div>
    );
  }

  if (!config.settings?.widgetEnabled) {
    return <div className="flex h-screen items-center justify-center bg-ink px-6 text-center text-sm text-zinc-500">{config.offlineMessage}</div>;
  }

  if (!conversation) {
    return <div className="flex h-screen items-center justify-center bg-ink text-sm text-zinc-500">Menyiapkan percakapan...</div>;
  }

  if (!leadSubmittedForConversation) {
    return (
      <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
        <Header
          config={config}
          connected={connected}
          canStartNew={false}
          canEndConversation={false}
          onStartNewConversation={() => undefined}
          onEndConversation={() => undefined}
        />
        <PreChatForm widgetColor={config.widgetColor} onSubmit={handlePreChatSubmit} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
      <Header
        config={config}
        connected={connected}
        canStartNew={conversationEnded}
        canEndConversation={!conversationEnded && !!conversation}
        onStartNewConversation={() => {
          setShowRating(false);
          widgetStorage.clearLeadConversationId();
          setLeadConversationId(null);
          startNewConversation().catch(() => undefined);
        }}
        onEndConversation={closeConversation}
      />
      <MessageList
        messages={messages}
        config={config}
        agentTyping={agentTyping}
        agentTypingName={agentTypingName}
        aiTyping={aiTyping}
        agentConnecting={agentConnecting}
      />
      {showRating ? (
        <div className="px-4 pb-3">
          <RatingForm widgetColor={config.widgetColor} onSubmit={(score, comment) => submitFeedback(score, comment)} />
        </div>
      ) : null}
      {conversationEnded ? (
        <div className="border-t border-zinc-800 bg-ink p-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-center">
            <p className="text-sm font-medium text-zinc-100">Percakapan ini sudah diakhiri.</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">Pilih Pesan Baru untuk memulai percakapan baru.</p>
            <button
              onClick={() => {
                setShowRating(false);
                widgetStorage.clearLeadConversationId();
                setLeadConversationId(null);
                startNewConversation().catch(() => undefined);
              }}
              className="mt-3 rounded-xl px-4 py-2 text-sm font-medium text-ink"
              style={{ backgroundColor: config.widgetColor }}
            >
              Pesan Baru
            </button>
          </div>
        </div>
      ) : (
        <Composer
          config={config}
          disabled={!connected}
          onSend={sendMessage}
          onTyping={notifyTyping}
          onRequestAgent={requestAgent}
          canRequestAgent={canRequestAgent}
        />
      )}
    </div>
  );
}
