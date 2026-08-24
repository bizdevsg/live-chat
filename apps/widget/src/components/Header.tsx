import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, MoreHorizontal, PowerOff, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerName = config.name === "Solid Gold — Website Utama" ? "Customer Service SGB" : config.name;
  const statusLabel = !connected ? "Menyambungkan..." : presenceStatus ? PRESENCE_LABEL[presenceStatus] : "Online";
  const statusDot = !connected ? "bg-zinc-500" : presenceStatus ? PRESENCE_DOT[presenceStatus] : "bg-emerald-400";

  useEffect(() => {
    if (!menuOpen) {
      setConfirmEnd(false);
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmEnd(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-ink px-4 py-3 text-white">
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
        {canStartNew || canEndConversation ? (
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Aksi percakapan"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-10 z-10 w-52 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
                {canEndConversation ? (
                  confirmEnd ? (
                    <div className="space-y-2">
                      <p className="text-xs leading-relaxed text-zinc-300">Akhiri percakapan yang sedang berjalan?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onEndConversation();
                            setMenuOpen(false);
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
                  ) : (
                    <button
                      onClick={() => setConfirmEnd(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                    >
                      <PowerOff className="h-4 w-4 shrink-0 text-zinc-400" />
                      Akhiri Percakapan
                    </button>
                  )
                ) : null}
                {canStartNew ? (
                  <button
                    onClick={() => {
                      onStartNewConversation();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                  >
                    <MessageSquarePlus className="h-4 w-4 shrink-0 text-zinc-400" />
                    Pesan Baru
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          aria-label="Tutup chat"
          onClick={() => sendToParent({ type: "solidchat:request-close" })}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
