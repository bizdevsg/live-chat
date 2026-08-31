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
import { TicketForm, type TicketValues } from "./components/TicketForm";
import { playNotificationSound, prepareNotificationSound } from "./lib/notification-sound";
import { widgetStorage } from "./lib/storage";

function isReplyMessage(senderType: string) {
  return senderType === "AI" || senderType === "AGENT";
}

function BusyNotice() {
  return (
    <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
      Saat ini lalu lintas chat kami sedang cukup padat. Silakan tunggu sebentar, pesan Anda berada dalam antrean prioritas kami.
    </div>
  );
}

function TicketSubmissionNotice({ ticketNumber, onSendAnother }: { ticketNumber: string; onSendAnother: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
      <p className="text-sm font-semibold text-white">Tiket Anda sudah tercatat</p>
      <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium tracking-wide text-zinc-300">{ticketNumber}</p>
      <p className="max-w-[85%] text-xs leading-relaxed text-zinc-500">
        Tim kami akan menghubungi Anda melalui email atau telepon secepatnya.
      </p>
      <button
        onClick={onSendAnother}
        className="rounded-xl border border-gold bg-gold px-4 py-2 text-sm font-semibold text-ink shadow-lg"
      >
        Kirim tiket lagi
      </button>
    </div>
  );
}

export default function App() {
  const { config, visitorToken, loading, error } = useWidgetSession();
  const {
    conversation,
    messages,
    lastIncomingReply,
    connected,
    presenceStatus,
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
  } = useConversation(visitorToken, config?.siteId ?? null, config?.presenceStatus);
  const [leadConversationId, setLeadConversationId] = useState(() => widgetStorage.getLeadConversationId());
  const [ticketInfo, setTicketInfo] = useState(() => widgetStorage.getTicketInfo());

  const isOffline = presenceStatus === "OFFLINE";
  const isBusy = presenceStatus === "BUSY";

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
    // Reload even when the ID is unchanged so the server-created greeting is immediately visible.
    await loadConversation(targetConversationId);
  }

  async function handleTicketSubmit(values: TicketValues): Promise<string> {
    if (!conversation || !visitorToken) {
      throw new Error("Percakapan belum siap. Coba lagi sebentar.");
    }

    const response = await api.post<{ id: string; ticketNumber: string }>(
      `/api/v1/widget/conversations/${conversation.id}/ticket`,
      values,
      visitorToken,
    );
    const info = { conversationId: conversation.id, ticketNumber: response.ticketNumber };
    widgetStorage.setTicketInfo(info);
    setTicketInfo(info);
    return response.ticketNumber;
  }

  function handleSendAnotherTicket() {
    widgetStorage.clearTicketInfo();
    setTicketInfo(null);
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

  useEffect(() => prepareNotificationSound(), []);

  useEffect(() => {
    if (panelOpen) {
      readCountRef.current = messages.length;
      setUnreadCount(0);
      return;
    }
    const unseen = messages.filter((m, i) => i >= readCountRef.current && isReplyMessage(m.senderType)).length;
    setUnreadCount(unseen);
  }, [messages, panelOpen]);

  useEffect(() => {
    sendToParent({ type: "solidchat:unread", count: unreadCount });
  }, [unreadCount]);

  useEffect(() => {
    if (!lastIncomingReply) return;
    playNotificationSound();
  }, [lastIncomingReply]);

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

  const ticketSubmittedForConversation = !!conversation && ticketInfo?.conversationId === conversation.id;

  if (isOffline && !leadSubmittedForConversation) {
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
        <Header
          config={config}
          connected={connected}
          presenceStatus={presenceStatus}
          canStartNew={false}
          canEndConversation={false}
          onStartNewConversation={() => undefined}
          onEndConversation={() => undefined}
        />
        {ticketSubmittedForConversation && ticketInfo ? (
          <TicketSubmissionNotice ticketNumber={ticketInfo.ticketNumber} onSendAnother={handleSendAnotherTicket} />
        ) : (
          <TicketForm
            widgetColor={config.widgetColor}
            offlineMessage={config.offlineMessage}
            onSubmit={handleTicketSubmit}
            onSendAnother={handleSendAnotherTicket}
          />
        )}
      </div>
    );
  }

  if (!leadSubmittedForConversation) {
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
        <Header
          config={config}
          connected={connected}
          presenceStatus={presenceStatus}
          canStartNew={false}
          canEndConversation={false}
          onStartNewConversation={() => undefined}
          onEndConversation={() => undefined}
        />
        {isBusy ? <BusyNotice /> : null}
        <PreChatForm widgetColor={config.widgetColor} onSubmit={handlePreChatSubmit} />
      </div>
    );
  }

  if (isOffline && !conversationEnded) {
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
        <Header
          config={config}
          connected={connected}
          presenceStatus={presenceStatus}
          canStartNew={false}
          canEndConversation={false}
          onStartNewConversation={() => undefined}
          onEndConversation={() => undefined}
        />
        {ticketSubmittedForConversation && ticketInfo ? (
          <TicketSubmissionNotice ticketNumber={ticketInfo.ticketNumber} onSendAnother={handleSendAnotherTicket} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TicketForm
              widgetColor={config.widgetColor}
              offlineMessage={config.offlineMessage}
              onSubmit={handleTicketSubmit}
              onSendAnother={handleSendAnotherTicket}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
      <Header
        config={config}
        connected={connected}
        presenceStatus={presenceStatus}
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
      {isBusy && !conversationEnded ? <BusyNotice /> : null}
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
