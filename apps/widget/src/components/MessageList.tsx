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

function Bubble({ message, config }: { message: WidgetMessage; config: SiteConfig }) {
  const isVisitor = message.senderType === "VISITOR" || message.senderType === "CUSTOMER";
  const isAi = message.senderType === "AI";
  const isSystem = message.senderType === "SYSTEM";
  const senderStyle = getSenderStyle(message.senderType);
  const senderLabel = isAi ? config.aiName : message.senderName?.trim() || "Agent";

  if (isSystem) {
    return <div className="mx-auto max-w-[85%] rounded-full bg-zinc-800 px-3 py-1 text-center text-[11px] text-zinc-400">{message.content}</div>;
  }

  return (
    <div className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {!isVisitor && <div className={`mb-0.5 ml-1 text-[10px] ${senderStyle.label}`}>{senderLabel}</div>}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isVisitor ? "rounded-br-sm text-ink" : senderStyle.bubble
          }`}
          style={isVisitor ? { backgroundColor: config.widgetColor } : undefined}
        >
          {isVisitor ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <RichText content={message.content} />
          )}
        </div>
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
function ConnectingAgentBadge() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-[85%] items-center justify-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-center text-[11px] text-zinc-300"
    >
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-zinc-400" />
      Sedang menghubungkan dengan agent
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
}: {
  messages: WidgetMessage[];
  config: SiteConfig;
  agentTyping: boolean;
  agentTypingName: string | null;
  aiTyping: boolean;
  agentConnecting: boolean;
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
      {agentConnecting && <ConnectingAgentBadge />}
      {aiTyping && <TypingBubble name={config.aiName} senderType="AI" />}
      {agentTyping && <TypingBubble name={agentTypingName?.trim() || "Agent"} senderType="AGENT" />}
      <div ref={endRef} />
    </div>
  );
}
