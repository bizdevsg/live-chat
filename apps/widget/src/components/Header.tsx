import { useEffect, useRef, useState } from "react";
import { LogOut, MessageSquarePlus, PowerOff, X } from "lucide-react";
import { sendToParent } from "../lib/postmessage";
import type { SiteConfig, SitePresenceStatus } from "../hooks/use-widget-session";

const PRESENCE_LABEL: Record<SitePresenceStatus, string> = {
  ONLINE: "Online",
  BUSY: "Sedang sibuk",
  OFFLINE: "Offline",
};

const PRESENCE_DOT: Record<SitePresenceStatus, string> = {
  ONLINE: "bg-emerald-400",
  BUSY: "bg-amber-400",
  OFFLINE: "bg-zinc-500",
};

const WIDGET_SURFACE_BACKGROUND = "linear-gradient(135deg, #3a3a3a 0%, #2e2e2e 55%, #222222 100%)";

export function Header({
  config,
  connected,
  presenceStatus,
  canStartNew,
  canEndConversation,
  onStartNewConversation,
  onEndConversation,
}: {
  config: SiteConfig;
  connected: boolean;
  presenceStatus?: SitePresenceStatus;
  canStartNew: boolean;
  canEndConversation: boolean;
  onStartNewConversation: () => void;
  onEndConversation: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerName = config.name === "Solid Gold — Website Utama" ? "Customer Service SGB" : config.name;
  const statusLabel = !connected ? "Menyambungkan..." : presenceStatus ? PRESENCE_LABEL[presenceStatus] : "Online";
  const statusDot = !connected ? "bg-zinc-500" : presenceStatus ? PRESENCE_DOT[presenceStatus] : "bg-emerald-400";

  useEffect(() => {
    if (!confirmEnd) return;

    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setConfirmEnd(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirmEnd]);

  return (
    <header
      className="flex items-center justify-between border-b border-zinc-700 px-4 py-3 text-white"
      style={{ background: WIDGET_SURFACE_BACKGROUND }}
    >
      <div className="flex items-center gap-2">
        <img src="/icon-header.png" alt={headerName} className="h-7 w-7 rounded-full object-cover" />
        <div>
          <div className="text-sm font-semibold">{headerName}</div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            {statusLabel}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canEndConversation ? (
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Akhiri percakapan"
              onClick={() => setConfirmEnd((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500 bg-linear-to-r from-red-500/20 text-red-500 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {confirmEnd ? (
              <div className="absolute right-0 top-10 z-10 w-52 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-zinc-300">Akhiri percakapan yang sedang berjalan?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onEndConversation();
                        setConfirmEnd(false);
                      }}
                      className="flex-1 rounded-lg bg-rose-500 px-3 py-2 text-xs font-medium text-white hover:bg-rose-400"
                    >
                      Ya, akhiri
                    </button>
                    <button
                      onClick={() => setConfirmEnd(false)}
                      className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {canStartNew ? (
          <button
            aria-label="Pesan baru"
            onClick={onStartNewConversation}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 hover:text-white"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        ) : null}
        <button
          aria-label="Tutup chat"
          onClick={() => sendToParent({ type: "solidchat:request-close" })}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 bg-zinc-700 hover:bg-zinc-400 hover:text-white transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
