import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, API_URL } from "../lib/api";
import { widgetStorage } from "../lib/storage";
import type { SitePresenceStatus } from "./use-widget-session";

export interface WidgetMessage {
  id: string;
  conversationId: string;
  senderType: string;
  messageType: string;
  content: string;
  createdAt: string;
  clientMessageId?: string | null;
  senderName?: string | null;
  attachments?: Array<{ id: string; fileName: string; mimeType: string }>;
}

function mergeMessage(messages: WidgetMessage[], incoming: WidgetMessage): WidgetMessage[] {
  const existingIndex = messages.findIndex(
    (message) => message.id === incoming.id || (!!incoming.clientMessageId && message.id === incoming.clientMessageId),
  );
  if (existingIndex === -1) return [...messages, incoming];
  const next = messages.slice();
  next[existingIndex] = incoming;
  return next;
}

function isReplyMessage(message: Pick<WidgetMessage, "senderType">) {
  return message.senderType === "AI" || message.senderType === "AGENT";
}

interface ConversationState {
  id: string;
  status: string;
  handlerType: string;
  assignedAt?: string | null;
}

const DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS = 60;

function isAwaitingAgentReply(conversation: ConversationState | null) {
  if (!conversation) return false;
  return (
    (conversation.status === "QUEUED" || conversation.status === "WAITING_AGENT" || conversation.status === "AGENT_ACTIVE") &&
    conversation.handlerType !== "AI"
  );
}

export function useConversation(
  visitorToken: string | null,
  siteId: string | null,
  initialPresence?: SitePresenceStatus,
  agentReplyTimeoutSeconds = DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS,
) {
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
  const [agentRequestStartedAt, setAgentRequestStartedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const conversationRequestVersionRef = useRef(0);
  const timeoutFallbackRequestRef = useRef<string | null>(null);

  const disconnectSocket = useCallback(() => {
    activeConversationIdRef.current = null;
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
      activeConversationIdRef.current = conv.id;
      const socket = io(`${API_URL}/widget`, { auth: { visitorToken }, transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (activeConversationIdRef.current !== conv.id) return;
        setConnected(true);
        socket.emit("widget:join", { conversationId: conv.id });
      });
      socket.on("disconnect", () => {
        if (activeConversationIdRef.current === conv.id) setConnected(false);
      });
      socket.on("message:created", (payload: { conversationId: string; internalOnly?: boolean; message: WidgetMessage }) => {
        if (activeConversationIdRef.current !== conv.id || payload.conversationId !== conv.id || payload.internalOnly) return;
        if (payload.message.senderType === "AI") {
          setAiTyping(false);
          if (agentRequested) {
            setAgentRequested(false);
            setAgentRequestStartedAt(null);
            widgetStorage.clearAgentRequestStartedAt(conv.id);
          }
        }
        // A human has spoken — the "connecting you to an agent" notice has served its purpose.
        if (payload.message.senderType === "AGENT") {
          setAgentRequested(false);
          setAgentRequestStartedAt(null);
          widgetStorage.clearAgentRequestStartedAt(conv.id);
        }
        if (isReplyMessage(payload.message)) setLastIncomingReply(payload.message);
        setMessages((prev) => mergeMessage(prev, payload.message));
      });
      socket.on("conversation:updated", (payload: { conversationId: string; status?: string; handlerType?: string; agentReplyTimeoutStartedAt?: string }) => {
        if (activeConversationIdRef.current !== conv.id || payload.conversationId !== conv.id) return;
        setConversation((prev) => {
          if (!prev || prev.id !== payload.conversationId) return prev;
          const next = { ...prev, status: payload.status ?? prev.status, handlerType: payload.handlerType ?? prev.handlerType };
          const hasStateUpdate = payload.status !== undefined || payload.handlerType !== undefined;
          if (!hasStateUpdate) {
            return next;
          }
          if (isAwaitingAgentReply(next)) {
            const storedStartedAt =
              payload.agentReplyTimeoutStartedAt ??
              (next.handlerType === "HUMAN" ? next.assignedAt : null) ??
              widgetStorage.getAgentRequestStartedAt(next.id) ??
              new Date().toISOString();
            widgetStorage.setAgentRequestStartedAt(next.id, storedStartedAt);
            setAgentRequestStartedAt(storedStartedAt);
          } else {
            widgetStorage.clearAgentRequestStartedAt(next.id);
            setAgentRequestStartedAt(null);
            if (next.handlerType === "AI") setAgentRequested(false);
          }
          return next;
        });
      });
      socket.on("typing:updated", (payload: { from: string; typing: boolean; senderName?: string | null }) => {
        if (activeConversationIdRef.current !== conv.id) return;
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
      const requestVersion = ++conversationRequestVersionRef.current;
      const detail = await api.get<{ conversation: ConversationState; messages: WidgetMessage[] }>(
        `/api/v1/widget/conversations/${conversationId}`,
        visitorToken,
      );
      if (requestVersion !== conversationRequestVersionRef.current || detail.conversation.id !== conversationId) return;
      widgetStorage.setConversationId(detail.conversation.id);
      setMessages(detail.messages);
      setLastIncomingReply(null);
      setConversation(detail.conversation);
      setAgentRequested(false);
      const storedStartedAt =
        (detail.conversation.handlerType === "HUMAN" ? detail.conversation.assignedAt : null) ??
        widgetStorage.getAgentRequestStartedAt(detail.conversation.id);
      if (!isAwaitingAgentReply(detail.conversation)) {
        widgetStorage.clearAgentRequestStartedAt(detail.conversation.id);
      }
      setAgentRequestStartedAt(isAwaitingAgentReply(detail.conversation) ? storedStartedAt : null);
      attachSocket(detail.conversation);
    },
    [attachSocket, visitorToken],
  );

  const initializeConversation = useCallback(async () => {
    if (!visitorToken) return;
    const requestVersion = ++conversationRequestVersionRef.current;

    const existingId = widgetStorage.getConversationId();
    if (!existingId) {
      if (requestVersion !== conversationRequestVersionRef.current) return;
      setConversation(null);
      setMessages([]);
      setLastIncomingReply(null);
      return;
    }

    try {
      const detail = await api.get<{ conversation: ConversationState; messages: WidgetMessage[] }>(
        `/api/v1/widget/conversations/${existingId}`,
        visitorToken,
      );
      if (requestVersion !== conversationRequestVersionRef.current) return;
      const ended = detail.conversation.status === "CLOSED" || detail.conversation.status === "RESOLVED";
      if (ended) {
        widgetStorage.clearConversationId();
        widgetStorage.clearLeadConversationId();
        setConversation(null);
        setMessages([]);
        setLastIncomingReply(null);
        disconnectSocket();
        return;
      }

      const conv = detail.conversation;
      setMessages(detail.messages);
      setLastIncomingReply(null);
      widgetStorage.setConversationId(conv.id);
      setConversation(conv);
      const storedStartedAt =
        (conv.handlerType === "HUMAN" ? conv.assignedAt : null) ?? widgetStorage.getAgentRequestStartedAt(conv.id);
      if (!isAwaitingAgentReply(conv)) {
        widgetStorage.clearAgentRequestStartedAt(conv.id);
      }
      setAgentRequestStartedAt(isAwaitingAgentReply(conv) ? storedStartedAt : null);
      attachSocket(conv);
    } catch {
      if (requestVersion !== conversationRequestVersionRef.current) return;
      widgetStorage.clearConversationId();
      widgetStorage.clearLeadConversationId();
      setConversation(null);
      setMessages([]);
      setLastIncomingReply(null);
      disconnectSocket();
    }
  }, [attachSocket, disconnectSocket, visitorToken]);

  useEffect(() => {
    if (!visitorToken) return;

    initializeConversation().catch(() => undefined);
    return () => {
      conversationRequestVersionRef.current += 1;
      disconnectSocket();
    };
  }, [disconnectSocket, initializeConversation, visitorToken, siteId]);

  useEffect(() => {
    if (!agentRequestStartedAt) return;
    // Refresh immediately — otherwise `now` stays at its mount-time value until the first tick a
    // second later, so the countdown briefly renders as (60s + however long the widget was open)
    // before snapping down to 00:59.
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [agentRequestStartedAt]);

  useEffect(() => {
    const conversationId = conversation?.id;
    if (!conversationId || !visitorToken || !agentRequestStartedAt) return;
    const timeoutMs = Math.max(10, Math.floor(agentReplyTimeoutSeconds)) * 1000;
    const deadlineAt = new Date(agentRequestStartedAt).getTime() + timeoutMs;
    if (Number.isNaN(deadlineAt)) return;

    const requestKey = `${conversationId}:${agentRequestStartedAt}`;
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempts = 0;

    // Fire at the deadline via a scheduled timer — not on the next incidental re-render — so
    // "AI kembali membantu percakapan ini" shows up the moment time is up. The server only flips
    // once its own clock says the wait elapsed, which can trail the widget's by a fraction of a
    // second, so retry a few times instead of giving up on the first `restored: false`.
    const fireAgentTimeout = () => {
      if (cancelled) return;
      if (timeoutFallbackRequestRef.current === requestKey && attempts === 0) return;
      timeoutFallbackRequestRef.current = requestKey;
      attempts += 1;

      api
        .post<{ restored: boolean; conversation: ConversationState }>(
          `/api/v1/widget/conversations/${conversationId}/agent-timeout`,
          {},
          visitorToken,
        )
        .then(async ({ restored, conversation: updatedConversation }) => {
          if (cancelled || activeConversationIdRef.current !== conversationId) return;
          setConversation((prev) =>
            prev?.id === conversationId
              ? { ...prev, status: updatedConversation.status, handlerType: updatedConversation.handlerType }
              : prev,
          );
          if (updatedConversation.handlerType === "AI") {
            setAgentRequested(false);
            setAgentRequestStartedAt(null);
            widgetStorage.clearAgentRequestStartedAt(updatedConversation.id);
          }
          if (!restored) {
            if (updatedConversation.handlerType !== "AI" && attempts < 5) {
              retryTimer = window.setTimeout(fireAgentTimeout, 3000);
            }
            return;
          }
          // The server posts a "AI kembali membantu percakapan ini" system message on timeout.
          // Pull the history in case the socket didn't deliver it, so it lands in the transcript.
          const detail = await api
            .get<{ conversation: ConversationState; messages: WidgetMessage[] }>(
              `/api/v1/widget/conversations/${updatedConversation.id}`,
              visitorToken,
            )
            .catch(() => null);
          if (cancelled || !detail) return;
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...detail.messages.filter((m) => !seen.has(m.id))];
          });
        })
        .catch(() => {
          if (!cancelled && attempts < 5) retryTimer = window.setTimeout(fireAgentTimeout, 3000);
        });
    };

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      fireAgentTimeout();
    } else {
      retryTimer = window.setTimeout(fireAgentTimeout, remainingMs);
    }
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [agentReplyTimeoutSeconds, agentRequestStartedAt, conversation?.id, visitorToken]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!conversation || !visitorToken) return;
      const clientMessageId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: clientMessageId, conversationId: conversation.id, clientMessageId, senderType: "VISITOR", messageType: "TEXT", content, createdAt: new Date().toISOString() },
      ]);
      api.post(`/api/v1/widget/conversations/${conversation.id}/messages`, { content, clientMessageId }, visitorToken).catch(() => undefined);
    },
    [conversation, visitorToken],
  );

  const uploadImage = useCallback(
    (file: File, content: string) => {
      if (!conversation || !visitorToken || conversation.handlerType !== "HUMAN") return Promise.reject(new Error("Agent belum menangani conversation ini."));
      const formData = new FormData();
      formData.append("file", file);
      formData.append("content", content);
      formData.append("clientMessageId", crypto.randomUUID());
      return api.upload(`/api/v1/widget/conversations/${conversation.id}/images`, formData, visitorToken).then((message) => {
        setMessages((prev) => mergeMessage(prev, message as WidgetMessage));
      });
    },
    [conversation, visitorToken],
  );

  const requestAgent = useCallback(() => {
    if (!conversation || !visitorToken) return;
    const startedAt = new Date().toISOString();
    setAgentRequested(true);
    setAgentRequestStartedAt(startedAt);
    widgetStorage.setAgentRequestStartedAt(conversation.id, startedAt);
    api
      .post<ConversationState>(`/api/v1/widget/conversations/${conversation.id}/request-agent`, {}, visitorToken)
      .then((updatedConversation) => {
        if (activeConversationIdRef.current !== updatedConversation.id) return;
        setConversation((prev) =>
          prev?.id === updatedConversation.id
            ? { ...prev, status: updatedConversation.status, handlerType: updatedConversation.handlerType }
            : prev,
        );
        if (isAwaitingAgentReply(updatedConversation)) {
          widgetStorage.setAgentRequestStartedAt(updatedConversation.id, startedAt);
          setAgentRequestStartedAt(startedAt);
          setAgentRequested(true);
          return;
        }
        setAgentRequested(false);
        setAgentRequestStartedAt(null);
        widgetStorage.clearAgentRequestStartedAt(updatedConversation.id);
      })
      .catch(() => {
        if (activeConversationIdRef.current !== conversation.id) return;
        // Roll the notice back rather than leaving a permanent "connecting..." that never resolves.
        setAgentRequested(false);
        setAgentRequestStartedAt(null);
        widgetStorage.clearAgentRequestStartedAt(conversation.id);
      });
  }, [conversation, visitorToken]);

  const closeConversation = useCallback(() => {
    if (!conversation || !visitorToken) return;
    api.post<ConversationState>(`/api/v1/widget/conversations/${conversation.id}/close`, {}, visitorToken)
      .then((updated) =>
        setConversation((prev) =>
          prev?.id === updated.id ? { ...prev, status: updated.status, handlerType: updated.handlerType } : prev,
        ),
      )
      .catch(() => undefined);
  }, [conversation, visitorToken]);

  const createNewConversation = useCallback(async () => {
    if (!visitorToken) throw new Error("Session visitor belum siap.");
    const requestVersion = ++conversationRequestVersionRef.current;
    const conv = await api.post<ConversationState>("/api/v1/widget/conversations?forceNew=true", {}, visitorToken);
    if (requestVersion !== conversationRequestVersionRef.current) {
      throw new Error("Pembuatan percakapan baru dibatalkan oleh permintaan yang lebih baru.");
    }
    widgetStorage.setConversationId(conv.id);
    setConversation(conv);
    setMessages([]);
    setLastIncomingReply(null);
    attachSocket(conv);
    return conv;
  }, [attachSocket, visitorToken]);

  const startNewConversation = useCallback(async () => {
    conversationRequestVersionRef.current += 1;
    disconnectSocket();
    widgetStorage.clearConversationId();
    setConversation(null);
    setMessages([]);
    setLastIncomingReply(null);
    setAgentRequested(false);
    if (conversation) {
      widgetStorage.clearAgentRequestStartedAt(conversation.id);
    }
    setAgentRequestStartedAt(null);
  }, [conversation, disconnectSocket]);

  const submitFeedback = useCallback(
    (score: number, comment?: string) => {
      if (!conversation || !visitorToken) return Promise.reject(new Error("Conversation tidak tersedia."));
      return api.post(`/api/v1/widget/conversations/${conversation.id}/feedback`, { score, comment }, visitorToken);
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

  const agentReplyTimeoutSecondsSafe = Math.max(10, Math.floor(agentReplyTimeoutSeconds));
  const agentReplyDeadlineAt = agentRequestStartedAt
    ? new Date(agentRequestStartedAt).getTime() + agentReplyTimeoutSecondsSafe * 1000
    : null;
  // Clamp to the configured window: `now` can momentarily lag the request, and it must never
  // render above the timeout and then jump down a second later.
  const agentReplyRemainingSeconds = agentReplyDeadlineAt
    ? Math.min(agentReplyTimeoutSecondsSafe, Math.max(0, Math.ceil((agentReplyDeadlineAt - now) / 1000)))
    : null;
  const agentReplyTimedOut = agentConnecting && agentReplyRemainingSeconds === 0;

  /**
   * The "talk to a human" button only makes sense once the AI is actually handling the
   * conversation: before the first AI reply there is nothing to escalate from, and once an agent
   * is already assigned (or on the way) a second request would just re-queue the same visitor.
   * Exception: once the connect-to-agent wait has timed out, re-offer the button so the visitor
   * can try again (the AI has meanwhile resumed the conversation).
   */
  const canRequestAgent =
    (!agentConnecting || agentReplyTimedOut) && !agentHandling && !conversationEnded && messages.some((m) => m.senderType === "AI");

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
    agentReplyRemainingSeconds,
    agentReplyTimedOut,
    agentHandling,
    canRequestAgent,
    sendMessage,
    uploadImage,
    requestAgent,
    closeConversation,
    startNewConversation,
    createNewConversation,
    submitFeedback,
    notifyTyping,
    loadConversation,
  };
}
