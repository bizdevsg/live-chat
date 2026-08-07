"use client";

import { useEffect, useState } from "react";
import { getDashboardSocket } from "@/lib/socket";
import { cn } from "@/components/ui/cn";

export function ConnectionIndicator() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getDashboardSocket();
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")} />
      {connected ? "Realtime tersambung" : "Menyambungkan ulang…"}
    </div>
  );
}
