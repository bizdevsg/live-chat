import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { WidgetMessage } from "../hooks/use-conversation";
import type { SiteConfig } from "../hooks/use-widget-session";
import { RichText } from "../lib/rich-text";

function getSenderStyle(senderType: WidgetMessage["senderType"]) {
  if (senderType === "AI") {
    return {
      label: "text-blue-300/80",
      bubble: "rounded-bl-sm border border-blue-800/70 bg-blue-950 text-blue-100",
      dots: "bg-blue-300",
    };
  }

  return {
    label: "text-emerald-300/80",
    bubble: "rounded-bl-sm border border-emerald-800/70 bg-emerald-950 text-emerald-100",
    dots: "bg-emerald-300",
  };
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Bubble({ message, config }: { message: WidgetMessage; config: SiteConfig }) {
  const isVisitor = message.senderType === "VISITOR" || message.senderType === "CUSTOMER";
  const isAi = message.senderType === "AI";
  const isSystem = message.senderType === "SYSTEM";
  const senderStyle = getSenderStyle(message.senderType);
  const senderLabel = isAi ? config.aiName : message.senderName?.trim() || "Agent";
  const messageTime = formatMessageTime(message.createdAt);

  if (isSystem) {
    return (
      <div className="text-[11px] text-center text-zinc-500">~ {message.content} ~</div>
    );
  }

  return (
    <div className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {!isVisitor && <div className={`mb-0.5 ml-1 text-[10px] ${senderStyle.label}`}>{senderLabel}</div>}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isVisitor ? "rounded-br-sm text-ink" : senderStyle.bubble
            }`}
          style={isVisitor ? { backgroundColor: config.widgetColor } : undefined}
        >
          {isVisitor ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <RichText content={message.content} />
          )}
        </div>
        {messageTime ? (
          <div className={`mt-1 text-[10px] ${isVisitor ? "mr-1 text-right text-zinc-500" : "ml-1 text-zinc-500"}`}>{messageTime}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Three bouncing dots inside a bubble, styled to match incoming (AI/agent) messages. */
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

/** Centered status pill shown while the visitor waits for a human to take over. */
function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

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

export function MessageList({
  messages,
  config,
  agentTyping,
  agentTypingName,
  aiTyping,
  agentConnecting,
  agentReplyRemainingSeconds,
  agentReplyTimedOut,
}: {
  messages: WidgetMessage[];
  config: SiteConfig;
  agentTyping: boolean;
  agentTypingName: string | null;
  aiTyping: boolean;
  agentConnecting: boolean;
  agentReplyRemainingSeconds: number | null;
  agentReplyTimedOut: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, agentTyping, agentTypingName, aiTyping, agentConnecting]);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto bg-ink px-4 py-4">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} config={config} />
      ))}
      {agentConnecting && !agentReplyTimedOut && <ConnectingAgentBadge remainingSeconds={agentReplyRemainingSeconds} />}
      {aiTyping && <TypingBubble name={config.aiName} senderType="AI" />}
      {agentTyping && <TypingBubble name={agentTypingName?.trim() || "Agent"} senderType="AGENT" />}
      <div ref={endRef} />
    </div>
  );
}
