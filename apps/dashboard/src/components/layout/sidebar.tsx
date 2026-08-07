"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/components/ui/cn";

export function Sidebar() {
  const pathname = usePathname();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-ink-600 bg-ink-800">
      <div className="flex h-16 items-center gap-2 border-b border-ink-600 px-5">
        <span className="text-lg font-bold text-gold-500">SolidChat</span>
        <span className="text-xs text-zinc-500">AI</span>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1 block rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-gold-500/15 text-gold-500" : "text-zinc-400 hover:bg-ink-700 hover:text-zinc-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-ink-600 p-3">
        <Link href="/profile" className="block truncate rounded-lg px-2 py-2 text-xs text-zinc-400 hover:bg-ink-700">
          {user?.name ?? "—"}
          <div className="truncate text-zinc-600">{user?.email}</div>
        </Link>
      </div>
    </aside>
  );
}
