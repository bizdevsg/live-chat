import { sendToParent } from "../lib/postmessage";
import type { SiteConfig } from "../hooks/use-widget-session";

export function Header({ config, connected }: { config: SiteConfig; connected: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-ink px-4 py-3 text-white">
      <div className="flex items-center gap-2">
        {config.logoUrl ? (
          <img src={config.logoUrl} alt={config.name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-ink" style={{ backgroundColor: config.widgetColor }}>
            {config.aiName.charAt(0)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold">{config.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-500"}`} />
            {connected ? "Online" : "Menyambungkan…"}
          </div>
        </div>
      </div>
      <button
        aria-label="Tutup chat"
        onClick={() => sendToParent({ type: "solidchat:request-close" })}
        className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
      >
        ✕
      </button>
    </header>
  );
}
