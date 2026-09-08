"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";
import { NAV_SECTIONS } from "./nav-items";

export function PermissionRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const user = useAuthStore((state) => state.user);

  const matchedSection = NAV_SECTIONS.find((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  const matchedItem = matchedSection?.items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const canAccess =
    !matchedItem ||
    ((matchedSection?.id !== "system" || isSuperAdminRole(user?.roles)) &&
      (!matchedItem.permission || hasPermission(matchedItem.permission)));

  useEffect(() => {
    if (user && !canAccess) {
      router.replace("/dashboard");
    }
  }, [canAccess, router, user]);

  if (!canAccess) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Mengalihkan ke Beranda...</div>;
  }

  return children;
}
