"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { Sidebar } from "@/components/layout/sidebar";
import { getDashboardSocket, disconnectDashboardSocket } from "@/lib/socket";

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, isError } = useMe();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    getDashboardSocket().connect();
    return () => disconnectDashboardSocket();
  }, [status]);

  if (isLoading || status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Memuat sesi…
      </div>
    );
  }

  if (status !== "authenticated") return null;

  return (
    <div className="flex h-screen bg-ink-900">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
