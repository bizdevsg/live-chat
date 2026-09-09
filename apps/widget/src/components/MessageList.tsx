import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { WidgetMessage } from "../hooks/use-conversation";
import type { SiteConfig } from "../hooks/use-widget-session";
import { RichText } from "../lib/rich-text";
import { api } from "../lib/api";
// Imported (not referenced from /public) so Vite fingerprints it — a background swap then ships
// as a new hashed URL and browsers pick it up immediately instead of serving a stale cache.
import bgWidget from "./conversation-bg.png";

/**
 * Per-sender Tailwind class sets, so incoming bubbles are colour-coded by who is speaking:
 *   - AI    → blue   (the bot / "aiName")
 *   - AGENT → green  (a human customer-service agent)
 *
 * `label` = the name shown above the bubble, `bubble` = the bubble surface, `dots` = the typing
 * indicator. Visitor ("you") messages never use this — they are painted with the site's brand
 * colour inline (see Bubble), so the switch here is really just AI-vs-agent.
 */
function getSenderStyle(senderType: WidgetMessage["senderType"]) {
  if (senderType === "AI") {
    return {
      label: "text-blue-300/80",
      bubble: "rounded-bl-sm border border-blue-800/70 bg-blue-950 text-blue-100",
      dots: "bg-blue-300",
    };
  }

  // AGENT (and any other non-AI incoming sender) → green.
  return {
    label: "text-emerald-300/80",
    bubble: "rounded-bl-sm border border-emerald-800/70 bg-emerald-950 text-emerald-100",
    dots: "bg-emerald-300",
  };
}

/** Message timestamp as "HH.mm" in Indonesian locale; "" when the date can't be parsed. */
function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * One image attachment. The widget never receives a direct file URL — it swaps the attachment id
 * for a short-lived signed URL on mount, and renders nothing until that resolves (or if it fails).
 */
function ImageAttachment({ conversationId, attachment, token }: { conversationId: string; attachment: NonNullable<WidgetMessage["attachments"]>[number]; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { api.get<{ url: string }>(`/api/v1/widget/conversations/${conversationId}/attachments/${attachment.id}/url`, token).then((data) => setUrl(data.url)).catch(() => setUrl(null)); }, [attachment.id, conversationId, token]);
  return url ? <img src={url} alt="Lampiran gambar" className="block max-h-64 max-w-full rounded-xl object-contain" /> : null;
}

/**
 * A single message row. Everything about its layout and styling is driven by `senderType`:
 *
 *   VISITOR / CUSTOMER ("you") → right-aligned · brand-colour bubble · no name label ·
 *                                plain text (visitors can't send formatting)
 *   AI                         → left-aligned  · blue bubble  · shows `aiName`      · rich text
 *   AGENT                      → left-aligned  · green bubble · shows agent's name  · rich text
 *   SYSTEM                     → centred "~ … ~" line, no bubble (e.g. "AI kembali membantu…")
 *
 * Image messages use tighter padding so the picture fills the bubble edge-to-edge.
 */
function Bubble({ message, config, token }: { message: WidgetMessage; config: SiteConfig; token: string }) {
  // Visitor = the customer typing in the widget; CUSTOMER = the same person once identified.
  const isVisitor = message.senderType === "VISITOR" || message.senderType === "CUSTOMER";
  const isAi = message.senderType === "AI";
  const isSystem = message.senderType === "SYSTEM";
  const hasImage = message.messageType === "IMAGE" && (message.attachments?.length ?? 0) > 0;
  // Only actually applied to incoming (AI / agent) bubbles; unused for visitor + system.
  const senderStyle = getSenderStyle(message.senderType);
  // Name above an incoming bubble: the configured AI name, or the agent's own name ("Agent" fallback).
  const senderLabel = isAi ? config.aiName : message.senderName?.trim() || "Agent";
  const messageTime = formatMessageTime(message.createdAt);

  // System messages are inline status notes, not a chat bubble.
  if (isSystem) {
    return (
      <div className="text-[11px] text-center text-zinc-500">~ {message.content} ~</div>
    );
  }

  return (
    // Visitor messages sit on the right; AI and agent both sit on the left.
    <div className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {/* Sender name — incoming only; "you" gets no label. Colour comes from senderStyle (blue AI / green agent). */}
        {!isVisitor && <div className={`mb-0.5 ml-1 text-[10px] ${senderStyle.label}`}>{senderLabel}</div>}
        <div
          className={`rounded-2xl text-sm leading-relaxed ${hasImage ? "p-1.5" : "px-3.5 py-2"} ${isVisitor ? "rounded-br-sm text-ink" : senderStyle.bubble
            }`}
          // Visitor bubble = the site's brand colour (config.widgetColor); AI/agent bubbles are coloured by senderStyle.
          style={isVisitor ? { backgroundColor: config.widgetColor } : undefined}
        >
          {hasImage ? <div className="grid gap-1">{message.attachments?.map((attachment) => <ImageAttachment key={attachment.id} conversationId={message.conversationId} attachment={attachment} token={token} />)}</div> : null}
          {message.content?.trim() ? (
            isVisitor ? (
              // Visitor text is shown verbatim — newlines preserved, no markdown parsing.
              <span className={`whitespace-pre-wrap ${hasImage ? "block px-1.5 pb-0.5 pt-1" : ""}`}>{message.content}</span>
            ) : (
              // AI / agent replies may contain links and light markdown → render through RichText.
              <div className={hasImage ? "px-1 pt-1.5" : ""}><RichText content={message.content} /></div>
            )
          ) : null}
        </div>
        {/* Timestamp under the bubble, aligned to the same side as the bubble. */}
        {messageTime ? (
          <div className={`mt-1 text-[10px] ${isVisitor ? "mr-1 text-right text-zinc-500" : "ml-1 text-zinc-500"}`}>{messageTime}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Three bouncing dots in an incoming-style bubble, shown live while the AI or an agent is typing.
 * Reuses getSenderStyle so the placeholder matches the colour of the reply that's coming (blue
 * for AI, green for agent).
 */
function TypingBubble({ name, senderType }: { name: string; senderType: "AI" | "AGENT" }) {
  const senderStyle = getSenderStyle(senderType);

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        <div className={`mb-0.5 ml-1 text-[10px] ${senderStyle.label}`}>{name}</div>
        <div className={`flex items-center gap-1 rounded-2xl px-3.5 py-3 ${senderStyle.bubble}`}>
          <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${senderStyle.dots} [animation-delay:-0.3s]`} />
          <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${senderStyle.dots} [animation-delay:-0.15s]`} />
          <span className={`h-1.5 w-1.5 animate-bounce rounded-full ${senderStyle.dots}`} />
        </div>
      </div>
    </div>
  );
}

/** "mm:ss" left-padded — the agent-reply countdown shown inside ConnectingAgentBadge. */
function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Centred status pill shown while the visitor is queued waiting for a human agent to pick up.
 * `remainingSeconds` counts down to when the AI automatically resumes the conversation; null
 * hides the exact countdown and shows a vaguer "sebentar lagi" message instead.
 */
function ConnectingAgentBadge({ remainingSeconds }: { remainingSeconds: number | null }) {
  const countdown = remainingSeconds === null ? null : formatRemainingTime(remainingSeconds);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-[85%] rounded-2xl border border-amber-500/20 bg-zinc-900/95 px-3 py-2 text-center text-[11px] text-zinc-300"
    >
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-300" />
        <span>Sedang menghubungkan dengan agent</span>
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-zinc-400">
        {countdown
          ? `Jika agent belum membalas, AI akan membantu lagi dalam ${countdown}.`
          : "Jika agent belum membalas, AI akan membantu lagi sebentar lagi."}
      </div>
    </div>
  );
}

/**
 * The scrollable chat transcript. Renders every message as a <Bubble>, then the live indicators
 * pinned to the bottom — the "connecting to an agent" pill and the AI/agent typing bubbles — and
 * keeps the newest item in view. The subtle icon pattern behind it is `conversation-bg.png`.
 */
export function MessageList({
  messages,
  config,
  agentTyping,
  agentTypingName,
  aiTyping,
  agentConnecting,
  agentReplyRemainingSeconds,
  agentReplyTimedOut,
  visitorToken,
}: {
  messages: WidgetMessage[];
  config: SiteConfig;
  agentTyping: boolean;
  agentTypingName: string | null;
  aiTyping: boolean;
  agentConnecting: boolean;
  agentReplyRemainingSeconds: number | null;
  agentReplyTimedOut: boolean;
  visitorToken: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever a message arrives or a typing/connecting indicator toggles.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, agentTyping, agentTypingName, aiTyping, agentConnecting]);

  return (
    <div
      className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto bg-ink bg-cover bg-center bg-no-repeat px-4 py-4"
      style={{ backgroundImage: `url(${bgWidget})` }}
    >
      {messages.map((m) => (
        <Bubble key={m.id} message={m} config={config} token={visitorToken} />
      ))}
      {/* Bottom-pinned live state: queue pill first, then whichever side is currently typing. */}
      {agentConnecting && !agentReplyTimedOut && <ConnectingAgentBadge remainingSeconds={agentReplyRemainingSeconds} />}
      {aiTyping && <TypingBubble name={config.aiName} senderType="AI" />}
      {agentTyping && <TypingBubble name={agentTypingName?.trim() || "Agent"} senderType="AGENT" />}
      <div ref={endRef} />
    </div>
  );
}
