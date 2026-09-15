"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BellOff,
  BellRing,
  Building2,
  Camera,
  KeyRound,
  LockKeyhole,
  LogOut,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCircle2,
  UserPen,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AccountSettingsPanel } from "@/components/account/account-settings-panel";
import { Topbar } from "@/components/layout/topbar";
import { DashboardPage, DashboardPageHeader, DashboardPageMetrics } from "@/components/layout/dashboard-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { type UserAccountSettings } from "@/lib/account-settings";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

/**
 * A plain `<img src>` can't attach the dashboard's Bearer token, so it can't point at an
 * auth-gated endpoint directly. Fetch the signed MinIO URL as authenticated JSON first (same
 * pattern chat image attachments already use), then hand `<img>` that unauthenticated URL.
 */
function useAvatarUrl(avatarStorageKey: string | null) {
  const query = useQuery({
    queryKey: ["auth", "profile", "avatar", avatarStorageKey],
    queryFn: () => apiClient.get<{ url: string }>("/api/v1/auth/profile/avatar"),
    enabled: !!avatarStorageKey,
  });
  return avatarStorageKey ? (query.data?.url ?? null) : null;
}

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

function EditProfileModal({ open, onClose, user }: { open: boolean; onClose: () => void; user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the form every time the modal opens, so a previous edit never leaks into the next one.
  useEffect(() => {
    if (open) {
      setName(user.name);
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
    }
  }, [open, user.name]);

  useEffect(() => {
    if (!avatarPreviewUrl) return;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  function applyUpdatedUser(updated: AuthUser) {
    setUser(updated);
    queryClient.setQueryData(["auth", "me"], updated);
  }

  function clearSelectedFile() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const saveProfile = useMutation({
    mutationFn: async () => {
      // Both edits are optional and independent — send whichever actually changed, name first so
      // a photo-only save doesn't also rewrite an unrelated name.
      let latest = user;
      const trimmedName = name.trim();
      if (trimmedName && trimmedName !== user.name) {
        latest = await apiClient.put<AuthUser>("/api/v1/auth/profile", { name: trimmedName });
      }
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        latest = await apiClient.upload<AuthUser>("/api/v1/auth/profile/avatar", formData);
      }
      return latest;
    },
    onSuccess: (updated) => {
      applyUpdatedUser(updated);
      toast.push("Profil berhasil diperbarui.", "success");
      onClose();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui profil.", "error"),
  });

  const removeAvatar = useMutation({
    mutationFn: () => apiClient.delete<AuthUser>("/api/v1/auth/profile/avatar"),
    onSuccess: (updated) => {
      applyUpdatedUser(updated);
      clearSelectedFile();
      toast.push("Foto profil dihapus.", "success");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus foto profil.", "error"),
  });

  const existingAvatarSrc = useAvatarUrl(user.avatarStorageKey);
  const previewSrc = avatarPreviewUrl ?? existingAvatarSrc;

  return (
    <Modal open={open} title="Edit Profil" onClose={onClose}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-600 bg-ink-700 text-xl font-semibold text-gold-500">
          {previewSrc ? <img src={previewSrc} alt="" className="h-full w-full object-cover" /> : getInitials(user.name)}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_AVATAR_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
                toast.push("Format foto harus PNG, JPEG, atau WEBP.", "error");
                return;
              }
              if (file.size > MAX_AVATAR_BYTES) {
                toast.push("Ukuran foto maksimal 3MB.", "error");
                return;
              }
              if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
              setAvatarFile(file);
              setAvatarPreviewUrl(URL.createObjectURL(file));
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Camera className="h-4 w-4" />
            Ganti Foto
          </Button>
          {user.avatarStorageKey || avatarFile ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removeAvatar.isPending}
              onClick={() => (avatarFile ? clearSelectedFile() : removeAvatar.mutate())}
            >
              <Trash2 className="h-4 w-4" />
              Hapus Foto
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="profile-name">Nama</Label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button disabled={saveProfile.isPending || !name.trim()} onClick={() => saveProfile.mutate()}>
          {saveProfile.isPending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  // Called before the `if (!user)` guard below, per rules of hooks — safe with a null user since
  // useAvatarUrl only enables its query once a storage key is actually present.
  const avatarSrc = useAvatarUrl(user?.avatarStorageKey ?? null);

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
                <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                  <UserPen className="h-4 w-4" />
                  Edit Profil
                </Button>
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
      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} user={user} />
    </>
  );
}
