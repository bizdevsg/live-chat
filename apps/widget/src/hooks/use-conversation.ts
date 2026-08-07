import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, API_URL } from "../lib/api";
import { widgetStorage } from "../lib/storage";

export interface WidgetMessage {
  id: string;
  senderType: string;
  messageType: string;
  content: string;
  createdAt: string;
}

interface ConversationState {
  id: string;
  status: string;
  handlerType: string;
}

export function useConversation(visitorToken: string | null, siteId: string | null) {
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!visitorToken) return;

    let cancelled = false;

    async function init() {
      const existingId = widgetStorage.getConversationId();
      let conv: ConversationState;
      try {
        if (existingId) {
          const detail = await api.get<{ conversation: ConversationState; messages: WidgetMessage[] }>(
            `/api/v1/widget/conversations/${existingId}`,
            visitorToken!,
          );
          conv = detail.conversation;
          if (!cancelled) setMessages(detail.messages);
        } else {
          conv = await api.post<ConversationState>("/api/v1/widget/conversations", {}, visitorToken!);
        }
      } catch {
        conv = await api.post<ConversationState>("/api/v1/widget/conversations", {}, visitorToken!);
      }
      if (cancelled) return;
      widgetStorage.setConversationId(conv.id);
      setConversation(conv);

      const socket = io(`${API_URL}/widget`, { auth: { visitorToken }, transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("widget:join", { conversationId: conv.id });
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("message:created", (payload: { conversationId: string; internalOnly?: boolean; message: WidgetMessage }) => {
        if (payload.conversationId !== conv.id || payload.internalOnly) return;
        setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
      });
      socket.on("conversation:updated", (payload: { conversationId: string; status?: string; handlerType?: string }) => {
        if (payload.conversationId !== conv.id) return;
        setConversation((prev) => (prev ? { ...prev, status: payload.status ?? prev.status, handlerType: payload.handlerType ?? prev.handlerType } : prev));
      });
      socket.on("typing:updated", (payload: { from: string; typing: boolean }) => {
        if (payload.from === "AGENT") setAgentTyping(payload.typing);
      });
    }

    init();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [visitorToken, siteId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!conversation || !visitorToken) return;
      const clientMessageId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: clientMessageId, senderType: "VISITOR", messageType: "TEXT", content, createdAt: new Date().toISOString() },
      ]);
      api.post(`/api/v1/widget/conversations/${conversation.id}/messages`, { content, clientMessageId }, visitorToken).catch(() => undefined);
    },
    [conversation, visitorToken],
  );

  const requestAgent = useCallback(() => {
    if (!conversation || !visitorToken) return;
    api.post(`/api/v1/widget/conversations/${conversation.id}/request-agent`, {}, visitorToken).catch(() => undefined);
  }, [conversation, visitorToken]);

  const closeConversation = useCallback(() => {
    if (!conversation || !visitorToken) return;
    api.post(`/api/v1/widget/conversations/${conversation.id}/close`, {}, visitorToken).catch(() => undefined);
  }, [conversation, visitorToken]);

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

  return { conversation, messages, connected, agentTyping, sendMessage, requestAgent, closeConversation, submitFeedback, notifyTyping };
}
