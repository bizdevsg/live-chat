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
    <header className="flex h-20 min-w-0 items-center justify-between gap-4 border-b border-ink-600 bg-ink-800/85 px-5 backdrop-blur md:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-zinc-100">{title}</h1>
        <p className="mt-1 hidden text-xs text-zinc-600 sm:block">SolidChat workspace</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4">
        <AgentStatusToggle />
        <div className="hidden lg:block">
          <ConnectionIndicator />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
        >
          Keluar
        </Button>
      </div>
    </header>
  );
}
