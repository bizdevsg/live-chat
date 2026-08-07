"use client";

import { useRouter } from "next/navigation";
import { useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "./connection-indicator";
import { AgentStatusToggle } from "./agent-status-toggle";

export function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const logout = useLogout();

  return (
    <header className="flex h-16 items-center justify-between border-b border-ink-600 bg-ink-800/60 px-6">
      <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
      <div className="flex items-center gap-4">
        <AgentStatusToggle />
        <ConnectionIndicator />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
        >
          Keluar
        </Button>
      </div>
    </header>
  );
}
