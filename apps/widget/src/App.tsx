import { useEffect, useState } from "react";
import { useWidgetSession } from "./hooks/use-widget-session";
import { useConversation } from "./hooks/use-conversation";
import { listenToParent, sendToParent } from "./lib/postmessage";
import { api } from "./lib/api";
import { Header } from "./components/Header";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { RatingForm } from "./components/RatingForm";
import { PreChatForm, type PreChatValues } from "./components/PreChatForm";

const LEAD_SUBMITTED_KEY = "solidchat_lead_submitted";

export default function App() {
  const { config, visitorToken, loading, error } = useWidgetSession();
  const { conversation, messages, connected, agentTyping, sendMessage, requestAgent, submitFeedback, notifyTyping } =
    useConversation(visitorToken, config?.siteId ?? null);
  const [leadSubmitted, setLeadSubmitted] = useState(() => sessionStorage.getItem(LEAD_SUBMITTED_KEY) === "1");

  function handlePreChatSubmit(values: PreChatValues) {
    if (conversation && visitorToken) {
      api.post(`/api/v1/widget/conversations/${conversation.id}/lead`, values, visitorToken).catch(() => undefined);
    }
    sessionStorage.setItem(LEAD_SUBMITTED_KEY, "1");
    setLeadSubmitted(true);
  }

  useEffect(() => {
    sendToParent({ type: "solidchat:ready" });
    return listenToParent((msg) => {
      if (msg.type === "solidchat:identify" && visitorToken) {
        api.post("/api/v1/widget/identify", { identityToken: msg.identityToken }, visitorToken).catch(() => undefined);
      }
    });
  }, [visitorToken]);

  useEffect(() => {
    sendToParent({ type: "solidchat:resize", height: 560 });
  }, []);

  const [showRating, setShowRating] = useState(false);
  useEffect(() => {
    if (conversation?.status === "RESOLVED" || conversation?.status === "CLOSED") {
      if (config?.settings?.ratingFormEnabled) setShowRating(true);
    }
  }, [conversation?.status, config?.settings?.ratingFormEnabled]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink text-sm text-zinc-500">Memuat SolidChat…</div>
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

  if (config.settings?.preChatFormEnabled && !leadSubmitted) {
    return (
      <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
        <Header config={config} connected={connected} />
        <PreChatForm widgetColor={config.widgetColor} onSubmit={handlePreChatSubmit} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
      <Header config={config} connected={connected} />
      <MessageList messages={messages} config={config} agentTyping={agentTyping} />
      {showRating && <div className="px-4 pb-3"><RatingForm widgetColor={config.widgetColor} onSubmit={(s, c) => submitFeedback(s, c)} /></div>}
      <Composer
        config={config}
        disabled={!connected}
        onSend={sendMessage}
        onTyping={notifyTyping}
        onRequestAgent={requestAgent}
      />
    </div>
  );
}
