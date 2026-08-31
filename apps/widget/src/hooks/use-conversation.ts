import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, API_URL } from "../lib/api";
import { widgetStorage } from "../lib/storage";
import type { SitePresenceStatus } from "./use-widget-session";

export interface WidgetMessage {
  id: string;
  senderType: string;
  messageType: string;
  content: string;
  createdAt: string;
  clientMessageId?: string | null;
  senderName?: string | null;
}

function isReplyMessage(message: Pick<WidgetMessage, "senderType">) {
  return message.senderType === "AI" || message.senderType === "AGENT";
}

interface ConversationState {
  id: string;
  status: string;
  handlerType: string;
}

export function useConversation(visitorToken: string | null, siteId: string | null, initialPresence?: SitePresenceStatus) {
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [lastIncomingReply, setLastIncomingReply] = useState<WidgetMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<SitePresenceStatus | undefined>(initialPresence);
  const [agentTyping, setAgentTyping] = useState(false);
  const [agentTypingName, setAgentTypingName] = useState<string | null>(null);
  const [aiTyping, setAiTyping] = useState(false);
  // Set optimistically the moment the visitor asks for a human, so the widget can acknowledge
  // the click immediately. The backend only flips conversation status/handlerType — it posts no
  // chat message — so without this the button would appear to do nothing at all.
  const [agentRequested, setAgentRequested] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setAgentTyping(false);
    setAgentTypingName(null);
    setAiTyping(false);
  }, []);

  const attachSocket = useCallback(
    (conv: ConversationState) => {
      if (!visitorToken) return;

      disconnectSocket();
      const socket = io(`${API_URL}/widget`, { auth: { visitorToken }, transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("widget:join", { conversationId: conv.id });
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("message:created", (payload: { conversationId: string; internalOnly?: boolean; message: WidgetMessage }) => {
        if (payload.conversationId !== conv.id || payload.internalOnly) return;
        if (payload.message.senderType === "AI") setAiTyping(false);
        // A human has spoken — the "connecting you to an agent" notice has served its purpose.
        if (payload.message.senderType === "AGENT") setAgentRequested(false);
        if (isReplyMessage(payload.message)) setLastIncomingReply(payload.message);
        setMessages((prev) => {
          const incoming = payload.message;
          const existingIndex = prev.findIndex(
            (m) => m.id === incoming.id || (!!incoming.clientMessageId && m.id === incoming.clientMessageId),
          );
          if (existingIndex !== -1) {
            const next = prev.slice();
            next[existingIndex] = incoming;
            return next;
          }
          return [...prev, incoming];
        });
      });
      socket.on("conversation:updated", (payload: { conversationId: string; status?: string; handlerType?: string }) => {
        if (payload.conversationId !== conv.id) return;
        setConversation((prev) => (prev ? { ...prev, status: payload.status ?? prev.status, handlerType: payload.handlerType ?? prev.handlerType } : prev));
      });
      socket.on("typing:updated", (payload: { from: string; typing: boolean; senderName?: string | null }) => {
        if (payload.from === "AGENT") {
          setAgentTyping(payload.typing);
          setAgentTypingName(payload.typing ? payload.senderName ?? null : null);
        }
        if (payload.from === "AI") setAiTyping(payload.typing);
      });
      // Pushed whenever an agent flips online/busy/offline — lets the widget switch between
      // live chat and the offline Ticket Form without the visitor needing to reload.
      socket.on("site:presence", (payload: { status: SitePresenceStatus }) => {
        setPresenceStatus(payload.status);
      });
    },
    [disconnectSocket, visitorToken],
  );

  useEffect(() => {
    setPresenceStatus(initialPresence);
  }, [initialPresence]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (!visitorToken) return;
      const detail = await api.get<{ conversation: ConversationState; messages: WidgetMessage[] }>(
        `/api/v1/widget/conversations/${conversationId}`,
        visitorToken,
      );
      widgetStorage.setConversationId(detail.conversation.id);
      setMessages(detail.messages);
      setLastIncomingReply(null);
      setConversation(detail.conversation);
      setAgentRequested(false);
      attachSocket(detail.conversation);
    },
    [attachSocket, visitorToken],
  );

  const initializeConversation = useCallback(async () => {
    if (!visitorToken) return;

    const existingId = widgetStorage.getConversationId();
    let conv: ConversationState;
    try {
      if (existingId) {
        const detail = await api.get<{ conversation: ConversationState; messages: WidgetMessage[] }>(
          `/api/v1/widget/conversations/${existingId}`,
          visitorToken,
        );
        conv = detail.conversation;
        setMessages(detail.messages);
        setLastIncomingReply(null);
      } else {
        conv = await api.post<ConversationState>("/api/v1/widget/conversations", {}, visitorToken);
        setMessages([]);
        setLastIncomingReply(null);
      }
    } catch {
      conv = await api.post<ConversationState>("/api/v1/widget/conversations", {}, visitorToken);
      setMessages([]);
      setLastIncomingReply(null);
    }

    widgetStorage.setConversationId(conv.id);
    setConversation(conv);
    attachSocket(conv);
  }, [attachSocket, visitorToken]);

  useEffect(() => {
    if (!visitorToken) return;

    initializeConversation().catch(() => undefined);
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket, initializeConversation, visitorToken, siteId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!conversation || !visitorToken) return;
      const clientMessageId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: clientMessageId, clientMessageId, senderType: "VISITOR", messageType: "TEXT", content, createdAt: new Date().toISOString() },
      ]);
      api.post(`/api/v1/widget/conversations/${conversation.id}/messages`, { content, clientMessageId }, visitorToken).catch(() => undefined);
    },
    [conversation, visitorToken],
  );

  const requestAgent = useCallback(() => {
    if (!conversation || !visitorToken) return;
    setAgentRequested(true);
    api.post(`/api/v1/widget/conversations/${conversation.id}/request-agent`, {}, visitorToken).catch(() => {
      // Roll the notice back rather than leaving a permanent "connecting..." that never resolves.
      setAgentRequested(false);
    });
  }, [conversation, visitorToken]);

  const closeConversation = useCallback(() => {
    if (!conversation || !visitorToken) return;
    api.post<ConversationState>(`/api/v1/widget/conversations/${conversation.id}/close`, {}, visitorToken)
      .then((updated) => setConversation((prev) => (prev ? { ...prev, status: updated.status, handlerType: updated.handlerType } : prev)))
      .catch(() => undefined);
  }, [conversation, visitorToken]);

  const startNewConversation = useCallback(async () => {
    if (!visitorToken) return;
    disconnectSocket();
    widgetStorage.clearConversationId();
    setConversation(null);
    setMessages([]);
    setLastIncomingReply(null);
    setAgentRequested(false);
    const conv = await api.post<ConversationState>("/api/v1/widget/conversations", {}, visitorToken);
    widgetStorage.setConversationId(conv.id);
    setConversation(conv);
    attachSocket(conv);
  }, [attachSocket, disconnectSocket, visitorToken]);

  const submitFeedback = useCallback(
    (score: number, comment?: string) => {
      if (!conversation || !visitorToken) return;
      api.post(`/api/v1/widget/conversations/${conversation.id}/feedback`, { score, comment }, visitorToken).catch(() => undefined);
    },
    [conversation, visitorToken],
  );

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!conversation) return;
      socketRef.current?.emit(typing ? "typing:start" : "typing:stop", { conversationId: conversation.id });
    },
    [conversation],
  );

  const conversationEnded = conversation?.status === "RESOLVED" || conversation?.status === "CLOSED";
  const agentHandling = conversation?.handlerType === "HUMAN";

  /** Waiting for a human to pick the conversation up — drives the in-chat "connecting" notice. */
  const agentConnecting = (agentRequested || conversation?.status === "QUEUED") && !agentHandling && !conversationEnded;

  /**
   * The "talk to a human" button only makes sense once the AI is actually handling the
   * conversation: before the first AI reply there is nothing to escalate from, and once an agent
   * is already assigned (or on the way) a second request would just re-queue the same visitor.
   */
  const canRequestAgent =
    !agentConnecting && !agentHandling && !conversationEnded && messages.some((m) => m.senderType === "AI");

  return {
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
  };
}
