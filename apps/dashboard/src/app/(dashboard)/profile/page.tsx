"use client";

import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, BellOff, BellRing, Building2, KeyRound, LogOut, Settings2, ShieldCheck, UserPen } from "lucide-react";
import { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInitials, useAvatarUrl } from "@/components/profile/profile-forms";
import { AccountSettingsPanel } from "@/components/account/account-settings-panel";
import { Topbar } from "@/components/layout/topbar";
import { DashboardPage, DashboardPageHeader } from "@/components/layout/dashboard-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type UserAccountSettings } from "@/lib/account-settings";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getNotificationSummary(settings: UserAccountSettings) {
  const enabledCount = Number(settings.playOnConversationSound) + Number(settings.playNewMessagesSound);

  if (enabledCount === 2) {
    return {
      label: "Aktif",
      description: "Semua notifikasi utama aktif dan siap dipakai.",
      badgeTone: "green" as const,
    };
  }

  if (enabledCount === 1) {
    return {
      label: "Sebagian",
      description: "Sebagian notifikasi aktif, sebagian lainnya dibisukan.",
      badgeTone: "amber" as const,
    };
  }

  return {
    label: "Nonaktif",
    description: "Semua notifikasi suara sedang dimatikan.",
    badgeTone: "neutral" as const,
  };
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-zinc-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate text-sm font-semibold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const router = useRouter();
  // Called before the `if (!user)` guard below, per rules of hooks — safe with a null user since
  // useAvatarUrl only enables its query once a storage key is actually present.
  const avatarSrc = useAvatarUrl(user?.avatarStorageKey ?? null);

  const logoutAll = useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/logout-all"),
    onSuccess: () => {
      toast.push("Semua sesi telah dicabut. Silakan login kembali.", "success");
      router.replace("/login?loggedOut=1");
    },
  });

  if (!user) return null;

  const notificationSummary = getNotificationSummary(user.accountSettings);
  const initials = getInitials(user.name);
  const organizationLabel = `${user.organizationId.slice(0, 8).toUpperCase()}…`;
  const rolesLabel =
    user.roles.length > 0 ? user.roles.map((role) => formatLabel(role)) : ["No assigned role"];

  return (
    <>
      <Topbar title="Profile & Security" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Profile & Security"
            description="Identitas akun, preferensi notifikasi, dan tindakan keamanan."
          />
          <Card className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-ink-600 bg-ink-700 text-xl font-semibold text-gold-500">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-800 bg-emerald-500 text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-zinc-50">{user.name}</h3>
                    <Badge tone="green">Verified</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-400">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rolesLabel.map((role) => (
                      <Badge key={role} tone="gold">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href="/profile/edit">
                  <Button variant="secondary" size="sm">
                    <UserPen className="h-4 w-4" />
                    Edit Profil
                  </Button>
                  </Link>
                <Link href="/profile/password">
                  <Button variant="secondary" size="sm">
                    <KeyRound className="h-4 w-4" />
                    Ganti Password
                  </Button>
                  </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => document.getElementById("notification-preferences")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <Settings2 className="h-4 w-4" />
                  Edit preferensi
                </Button>
                <Button variant="danger" size="sm" onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending}>
                  <LogOut className="h-4 w-4" />
                  {logoutAll.isPending ? "Mencabut sesi…" : "Cabut semua sesi"}
                </Button>
              </div>
              </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-600 pt-5 sm:grid-cols-4">
              <StatItem label="Roles" value={String(user.roles.length)} icon={<BadgeCheck className="h-4 w-4" />} />
              <StatItem label="Permissions" value={String(user.permissions.length)} icon={<KeyRound className="h-4 w-4" />} />
              <StatItem
                label="Notifikasi"
                value={notificationSummary.label}
                icon={
                  notificationSummary.badgeTone === "neutral" ? (
                    <BellOff className="h-4 w-4" />
                  ) : (
                    <BellRing className="h-4 w-4" />
                  )
                }
              />
              <StatItem label="Workspace" value={organizationLabel} icon={<Building2 className="h-4 w-4" />} />
            </div>
          </Card>

          <AccountSettingsPanel />
        </div>
      </DashboardPage>
    </>
  );
}
