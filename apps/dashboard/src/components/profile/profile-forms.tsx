"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS } from "@solidchat/shared";

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

/**
 * A plain `<img src>` can't attach the dashboard's Bearer token, so it can't point at an
 * auth-gated endpoint directly. Fetch the signed MinIO URL as authenticated JSON first (same
 * pattern chat image attachments already use), then hand `<img>` that unauthenticated URL.
 */
export function useAvatarUrl(avatarStorageKey: string | null) {
  const query = useQuery({
    queryKey: ["auth", "profile", "avatar", avatarStorageKey],
    queryFn: () => apiClient.get<{ url: string }>("/api/v1/auth/profile/avatar"),
    enabled: !!avatarStorageKey,
  });
  return avatarStorageKey ? (query.data?.url ?? null) : null;
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function EditProfileForm({ user }: { user: AuthUser }) {
  const open = true;
  const router = useRouter();
  const onClose = () => router.push("/profile");
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
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-5 shadow-panel">
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
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  resetKey,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  resetKey: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Sembunyikan password" : "Tampilkan password";

  useEffect(() => setVisible(false), [resetKey]);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        required
        minLength={autoComplete === "new-password" ? PASSWORD_MIN_LENGTH : 1}
        maxLength={autoComplete === "new-password" ? PASSWORD_MAX_LENGTH : 512}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-400 transition hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500/60"
      >
        {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function ChangePasswordForm() {
  const open = true;
  const router = useRouter();
  const onClose = () => router.push("/profile");
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => apiClient.put("/api/v1/auth/profile/password", { currentPassword, newPassword }),
    onSuccess: () => {
      toast.push("Password berhasil diganti. Sesi lain telah dicabut.", "success");
      onClose();
    },
    onError: (error) => toast.push(error instanceof ApiError ? error.message : "Gagal mengganti password.", "error"),
  });

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-5 shadow-panel">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (newPassword !== confirmPassword) {
            toast.push("Konfirmasi password baru tidak cocok.", "error");
            return;
          }
          const passwordError = getPasswordPolicyError(newPassword);
          if (passwordError) {
            toast.push(passwordError, "error");
            return;
          }
          if (currentPassword === newPassword) {
            toast.push("Password baru harus berbeda dari password saat ini.", "error");
            return;
          }
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="current-password">Password Saat Ini</Label>
          <PasswordInput id="current-password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" resetKey={open} />
        </div>
        <div>
          <Label htmlFor="new-password">Password Baru</Label>
          <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" resetKey={open} />
          <ul className="mt-2 space-y-1 text-xs text-zinc-500" aria-label="Syarat password baru">
            {PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>• {requirement}</li>
            ))}
          </ul>
        </div>
        <div>
          <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
          <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" resetKey={open} />
        </div>
        <p className="text-xs leading-5 text-zinc-500">Setelah berhasil, seluruh sesi selain perangkat ini akan dicabut.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Mengganti…" : "Ganti Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

