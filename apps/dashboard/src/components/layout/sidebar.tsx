"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";
import { Permission } from "@/lib/permissions";
import type { ConversationSummary } from "@/lib/types";
import { NAV_SECTIONS, type NavIcon } from "./nav-items";
import { getDashboardSocket } from "@/lib/socket";
import { cn } from "@/components/ui/cn";

function SidebarIcon({ icon, active }: { icon: NavIcon; active: boolean }) {
  const stroke = active ? "#b99244" : "currentColor";
  const commonProps = {
    fill: "none",
    stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  const paths: Record<NavIcon, ReactNode> = {
    home: (
      <>
        <path {...commonProps} d="M3.5 9.5 12 3l8.5 6.5" />
        <path {...commonProps} d="M5.5 8.5v8h13v-8" />
        <path {...commonProps} d="M9.5 16.5v-4h5v4" />
      </>
    ),
    inbox: (
      <>
        <path {...commonProps} d="M4 6.5h16v10H4z" />
        <path {...commonProps} d="M4 12.5h4l2 2h4l2-2h4" />
      </>
    ),
    chart: (
      <>
        <path {...commonProps} d="M5 18.5V11" />
        <path {...commonProps} d="M10 18.5V7.5" />
        <path {...commonProps} d="M15 18.5V13" />
        <path {...commonProps} d="M20 18.5V5.5" />
      </>
    ),
    ticket: (
      <>
        <path {...commonProps} d="M5 7.5h14a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4v-2a1 1 0 0 1 1-1Z" />
        <path {...commonProps} d="M12 7.5v10" />
      </>
    ),
    users: (
      <>
        <path {...commonProps} d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path {...commonProps} d="M15.5 12a2.5 2.5 0 1 0 0-5" />
        <path {...commonProps} d="M4.5 18c.8-2.2 2.8-3.5 5.5-3.5S14.7 15.8 15.5 18" />
        <path {...commonProps} d="M15.5 14.8c1.8.2 3.1 1.2 4 3.2" />
      </>
    ),
    lead: (
      <>
        <path {...commonProps} d="M12 4.5c-2.8 0-5 2.2-5 5 0 3.5 5 9 5 9s5-5.5 5-9c0-2.8-2.2-5-5-5Z" />
        <path {...commonProps} d="M12 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </>
    ),
    book: (
      <>
        <path {...commonProps} d="M6 5.5h10a2 2 0 0 1 2 2v10H8a2 2 0 0 0-2 2Z" />
        <path {...commonProps} d="M6 5.5v14a2 2 0 0 1 2-2h10" />
      </>
    ),
    spark: (
      <>
        <path {...commonProps} d="m12 3.5 1.7 4.8 4.8 1.7-4.8 1.7-1.7 4.8-1.7-4.8-4.8-1.7 4.8-1.7Z" />
        <path {...commonProps} d="m18.5 14.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
      </>
    ),
    bot: (
      <>
        <rect {...commonProps} x="5" y="7" width="14" height="10" rx="3" />
        <path {...commonProps} d="M12 4.5v2" />
        <path {...commonProps} d="M9 11h.01" />
        <path {...commonProps} d="M15 11h.01" />
        <path {...commonProps} d="M9 14.5c1 .7 2 .9 3 .9s2-.2 3-.9" />
      </>
    ),
    message: (
      <>
        <path {...commonProps} d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
        <path {...commonProps} d="M8 10.5h8" />
        <path {...commonProps} d="M8 13.5h5" />
      </>
    ),
    widget: (
      <>
        <rect {...commonProps} x="5" y="4.5" width="14" height="15" rx="2.5" />
        <path {...commonProps} d="M9 8.5h6" />
        <path {...commonProps} d="M9 12h6" />
        <path {...commonProps} d="M12 16h.01" />
      </>
    ),
    route: (
      <>
        <circle {...commonProps} cx="6.5" cy="6.5" r="2.5" />
        <circle {...commonProps} cx="17.5" cy="17.5" r="2.5" />
        <path {...commonProps} d="M8.5 6.5h2a4 4 0 0 1 4 4v2" />
        <path {...commonProps} d="M14.5 12.5h3" />
      </>
    ),
    team: (
      <>
        <path {...commonProps} d="M7.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path {...commonProps} d="M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path {...commonProps} d="M3.5 18c.6-2 2.2-3.2 4.5-3.2S12 16 12.5 18" />
        <path {...commonProps} d="M11.5 18c.5-2 2.1-3.2 4.5-3.2S19.9 16 20.5 18" />
      </>
    ),
    shield: (
      <>
        <path {...commonProps} d="M12 4.5 19 7v4.5c0 4-2.5 6.5-7 8-4.5-1.5-7-4-7-8V7Z" />
      </>
    ),
    file: (
      <>
        <path {...commonProps} d="M8 4.5h6l4 4v11H8a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
        <path {...commonProps} d="M14 4.5v4h4" />
        <path {...commonProps} d="M9.5 12h5" />
        <path {...commonProps} d="M9.5 15h5" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      {paths[icon]}
    </svg>
  );
}

function formatSidebarBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}

function isOngoingConversation(status: string) {
  return !["RESOLVED", "CLOSED", "SPAM", "BLOCKED"].includes(status);
}

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = isSuperAdminRole(user?.roles);
  const canHandleInbox = hasPermission(Permission.CONVERSATION_HANDLE);
  const canManageTickets = hasPermission(Permission.TICKET_MANAGE);

  const inboxBadgeQuery = useQuery({
    queryKey: ["agent", "queue"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/queue"),
    enabled: canHandleInbox,
    refetchInterval: 15000,
  });

  const ongoingInboxQuery = useQuery({
    queryKey: ["agent", "conversations", "mine"],
    queryFn: () => apiClient.get<ConversationSummary[]>("/api/v1/agent/conversations"),
    enabled: canHandleInbox,
    refetchInterval: 15000,
  });

  const ticketsBadgeQuery = useQuery({
    queryKey: ["tickets", "sidebar", "badge"],
    queryFn: async () => {
      const [open, inProgress] = await Promise.all([
        apiClient.get<{ total: number }>("/api/v1/tickets?status=OPEN"),
        apiClient.get<{ total: number }>("/api/v1/tickets?status=IN_PROGRESS"),
      ]);
      return open.total + inProgress.total;
    },
    enabled: canManageTickets,
    refetchInterval: 15000,
  });

  useEffect(() => {
    const socket = getDashboardSocket();
    const invalidateInbox = () => {
      queryClient.invalidateQueries({ queryKey: ["agent", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["agent", "conversations", "mine"] });
    };
    const invalidateTickets = () => queryClient.invalidateQueries({ queryKey: ["tickets"] });

    socket.on("queue:updated", invalidateInbox);
    socket.on("conversation:updated", invalidateInbox);
    socket.on("conversation:assigned", invalidateInbox);
    socket.on("notification:new", invalidateInbox);
    socket.on("notification:new", invalidateTickets);

    return () => {
      socket.off("queue:updated", invalidateInbox);
      socket.off("conversation:updated", invalidateInbox);
      socket.off("conversation:assigned", invalidateInbox);
      socket.off("notification:new", invalidateInbox);
      socket.off("notification:new", invalidateTickets);
    };
  }, [queryClient]);

  const inboxBadgeCount =
    (inboxBadgeQuery.data?.length ?? 0) + (ongoingInboxQuery.data?.filter((conversation) => isOngoingConversation(conversation.status)).length ?? 0);

  const badgeByHref: Partial<Record<string, number>> = {
    "/inbox": inboxBadgeCount,
    "/tickets": ticketsBadgeQuery.data ?? 0,
  };

  const sections = NAV_SECTIONS.filter((section) => section.id !== "system" || isSuperadmin)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || hasPermission(item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-ink-600 bg-ink-800">
      <div className="flex h-20 items-center border-b border-ink-600 px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/10 text-xl font-bold text-gold-500">
          SC
        </div>
        <div className="ml-3 min-w-0">
          <div className="truncate text-sm font-semibold uppercase tracking-[0.24em] text-zinc-100">SolidChat</div>
          <div className="mt-1 text-xs tracking-[0.3em] text-gold-500/80">ADMIN PANEL</div>
        </div>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.id} className="mb-7 last:mb-0">
            <div className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-gold-500/70">{section.label}</div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors",
                      active
                        ? "border border-gold-500/20 bg-gold-500/12 text-gold-500 shadow-[0_0_0_1px_rgba(185,146,68,0.08)]"
                        : "text-zinc-400 hover:bg-ink-700 hover:text-zinc-100",
                    )}
                  >
                    <SidebarIcon icon={item.icon} active={active} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {(badgeByHref[item.href] ?? 0) > 0 && (
                      <span
                        className={cn(
                          "inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                          active ? "bg-gold-500 text-ink-900" : "bg-rose-500 text-white",
                        )}
                      >
                        {formatSidebarBadge(badgeByHref[item.href] ?? 0)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-600 p-4">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors",
            pathname === "/profile"
              ? "border-gold-500/20 bg-gold-500/12 text-gold-500 shadow-[0_0_0_1px_rgba(185,146,68,0.08)]"
              : "border-ink-600 bg-ink-700/60 hover:bg-ink-700",
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/10 text-sm font-semibold text-gold-500">
            {(user?.name ?? "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-100">{user?.name ?? "User"}</div>
            <div className="truncate text-xs text-zinc-500">{user?.email ?? "No email"}</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
