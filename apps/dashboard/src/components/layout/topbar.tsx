"use client";

import { useRouter } from "next/navigation";
import { useLogout } from "@/hooks/use-auth";
import { useDashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "./connection-indicator";
import { AgentStatusToggle } from "./agent-status-toggle";

export function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const logout = useLogout();
  const { toggleSidebar } = useDashboardShell();

  return (
    <header className="flex min-h-[5rem] min-w-0 flex-wrap items-center justify-between gap-3 border-b border-ink-600 bg-ink-800/85 px-4 py-3 backdrop-blur sm:px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Buka menu navigasi"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-700 text-zinc-200 transition-colors hover:bg-ink-600 lg:hidden"
        >
          <span className="flex flex-col gap-1">
            <span className="h-0.5 w-4 rounded-full bg-current" />
            <span className="h-0.5 w-4 rounded-full bg-current" />
            <span className="h-0.5 w-4 rounded-full bg-current" />
          </span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-zinc-100">{title}</h1>
          <p className="mt-1 hidden text-xs text-zinc-600 sm:block">SolidChat workspace</p>
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3 md:gap-4">
        <AgentStatusToggle />
        <div className="hidden md:block">
          <ConnectionIndicator />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
        >
          Keluar
        </Button>
      </div>
    </header>
  );
}
