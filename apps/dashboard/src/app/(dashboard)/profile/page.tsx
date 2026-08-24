"use client";

import { useMutation } from "@tanstack/react-query";
import {
  BadgeCheck,
  BellOff,
  BellRing,
  Building2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Settings2,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AccountSettingsPanel } from "@/components/account/account-settings-panel";
import { Topbar } from "@/components/layout/topbar";
import { DashboardPage, DashboardPageHeader, DashboardPageMetrics } from "@/components/layout/dashboard-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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

function SecurityRow({
  title,
  description,
  status,
  statusTone,
  icon,
}: {
  title: string;
  description: string;
  status: string;
  statusTone: "green" | "gold" | "neutral" | "amber";
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-700 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0 text-zinc-500">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100">{title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
      </div>
      <Badge tone={statusTone} className="shrink-0">
        {status}
      </Badge>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const router = useRouter();

  const logoutAll = useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/logout-all"),
    onSuccess: () => {
      toast.push("Semua sesi telah dicabut. Silakan login kembali.", "success");
      router.replace("/login");
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
            description="Ruang profil sekarang menonjolkan identitas akun, status notifikasi, dan tindakan keamanan penting dalam satu permukaan kerja yang lebih terstruktur."
          />
          <DashboardPageMetrics
            items={[
              { label: "Roles", value: String(user.roles.length), detail: "Role aktif yang melekat pada akun ini." },
              { label: "Permissions", value: String(user.permissions.length), detail: "Hak akses efektif yang dimiliki akun." },
              { label: "Notifikasi", value: notificationSummary.label, detail: notificationSummary.description },
              { label: "Workspace", value: organizationLabel, detail: "Organisasi aktif yang menaungi akun saat ini." },
            ]}
          />

          <Card className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-700 text-xl font-semibold text-gold-500">
                  {initials}
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

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <AccountSettingsPanel />

            <Card className="p-6">
              <div>
                <CardTitle className="text-base">Security insights</CardTitle>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Ringkasan cepat untuk memastikan akun ini tetap aman dan terkontrol.
                </p>
              </div>

              <div className="mt-4">
                <SecurityRow
                  title="Session protection"
                  description="Cabut semua sesi aktif kapan saja jika perangkat hilang atau ada aktivitas mencurigakan."
                  status="Siap"
                  statusTone="green"
                  icon={<LockKeyhole className="h-4 w-4" />}
                />
                <SecurityRow
                  title="Account scope"
                  description={`Akun ini membawa ${user.permissions.length} permission dari ${user.roles.length} role.`}
                  status="Terpetakan"
                  statusTone="gold"
                  icon={<UserCircle2 className="h-4 w-4" />}
                />
                <SecurityRow
                  title="Notification readiness"
                  description={notificationSummary.description}
                  status={notificationSummary.label}
                  statusTone={notificationSummary.badgeTone}
                  icon={<BellRing className="h-4 w-4" />}
                />
              </div>
            </Card>
          </div>
        </div>
      </DashboardPage>
    </>
  );
}
