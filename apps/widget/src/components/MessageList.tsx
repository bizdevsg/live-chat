import { useEffect, useRef } from "react";
import type { WidgetMessage } from "../hooks/use-conversation";
import type { SiteConfig } from "../hooks/use-widget-session";

function Bubble({ message, config }: { message: WidgetMessage; config: SiteConfig }) {
  const isVisitor = message.senderType === "VISITOR" || message.senderType === "CUSTOMER";
  const isAi = message.senderType === "AI";
  const isSystem = message.senderType === "SYSTEM";

  if (isSystem) {
    return <div className="mx-auto max-w-[85%] rounded-full bg-zinc-800 px-3 py-1 text-center text-[11px] text-zinc-400">{message.content}</div>;
  }

  return (
    <div className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {!isVisitor && <div className="mb-0.5 ml-1 text-[10px] text-zinc-500">{isAi ? config.aiName : "Agent"}</div>}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isVisitor ? "rounded-br-sm text-ink" : "rounded-bl-sm bg-zinc-800 text-zinc-100"
          }`}
          style={isVisitor ? { backgroundColor: config.widgetColor } : undefined}
        >
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    </div>
  );
}

export function MessageList({ messages, config, agentTyping }: { messages: WidgetMessage[]; config: SiteConfig; agentTyping: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, agentTyping]);

  return (
    <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-ink px-4 py-4">
      <div className="mx-auto max-w-[85%] rounded-2xl bg-zinc-800 px-3.5 py-2 text-sm text-zinc-200">{config.greeting}</div>
      {messages.map((m) => (
        <Bubble key={m.id} message={m} config={config} />
      ))}
      {agentTyping && <div className="ml-1 text-xs italic text-zinc-500">Agent sedang mengetik…</div>}
      <div ref={endRef} />
    </div>
  );
}
