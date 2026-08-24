"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, MessageSquareMore, Play, Square, Upload } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";
import { DEFAULT_USER_ACCOUNT_SETTINGS, normalizeUserAccountSettings, type NotificationSoundCategory, type UserAccountSettings } from "@/lib/account-settings";
import { getNotificationSoundOptions } from "@/lib/notification-sounds";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";

function NotificationPreferenceRow({
  id,
  title,
  description,
  enabled,
  value,
  options,
  onToggle,
  onChange,
  onPreview,
  isPreviewing,
  onUpload,
  isUploading,
  customFileName,
  icon,
}: {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  value: string;
  options: Array<{ id: string; label: string }>;
  onToggle: (checked: boolean) => void;
  onChange: (value: string) => void;
  onPreview: () => void;
  isPreviewing: boolean;
  onUpload: () => void;
  isUploading: boolean;
  customFileName?: string | null;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-zinc-400">{icon}</div>
          <div className="min-w-0">
            <Label htmlFor={id}>{title}</Label>
            <p className="text-sm leading-6 text-zinc-400">{description}</p>
          </div>
        </div>

        <label className="inline-flex shrink-0 items-center gap-2 self-start text-sm text-zinc-300 sm:self-center">
          <span>{enabled ? "Aktif" : "Nonaktif"}</span>
          <span className="relative inline-flex h-5 w-9 items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onToggle(event.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-ink-600 transition peer-checked:bg-gold-500" />
            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={!enabled}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" size="sm" onClick={onPreview} disabled={!enabled}>
          {isPreviewing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPreviewing ? "Stop" : "Preview"}
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          {customFileName ? `Custom aktif: ${customFileName}` : "Belum ada audio custom untuk kategori ini."}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onUpload} disabled={isUploading}>
          <Upload className="h-4 w-4" />
          {isUploading ? "Mengunggah..." : customFileName ? "Ganti custom" : "Upload custom"}
        </Button>
      </div>
    </div>
  );
}

export function AccountSettingsPanel() {
  const onConversationFileInputRef = useRef<HTMLInputElement | null>(null);
  const newMessagesFileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState<UserAccountSettings>(user?.accountSettings ?? DEFAULT_USER_ACCOUNT_SETTINGS);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["auth", "account-settings"],
    queryFn: () => apiClient.get<UserAccountSettings>("/api/v1/auth/account-settings"),
    initialData: user?.accountSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) setForm(normalizeUserAccountSettings(settingsQuery.data));
  }, [settingsQuery.data]);

  useEffect(() => {
    return () => {
      if (!previewAudioRef.current) return;
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current.onended = null;
      previewAudioRef.current = null;
    };
  }, []);

  const applyResolvedSettings = (data: UserAccountSettings) => {
    const normalized = normalizeUserAccountSettings(data);
    setForm(normalized);
    queryClient.setQueryData(["auth", "account-settings"], normalized);
    queryClient.setQueryData<AuthUser | undefined>(["auth", "me"], (current) =>
      current ? { ...current, accountSettings: normalized } : current,
    );
    if (user) setUser({ ...user, accountSettings: normalized });
    return normalized;
  };

  const saveMutation = useMutation({
    mutationFn: () => apiClient.put<UserAccountSettings>("/api/v1/auth/account-settings", form),
    onSuccess: (data) => {
      applyResolvedSettings(data);
      toast.push("Pengaturan notifikasi berhasil disimpan.", "success");
    },
    onError: (error) => {
      toast.push(error instanceof ApiError ? error.message : "Gagal menyimpan pengaturan notifikasi.", "error");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ category, file }: { category: NotificationSoundCategory; file: File }) => {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("file", file);
      return apiClient.upload<UserAccountSettings>("/api/v1/auth/account-settings/notification-sounds", formData);
    },
    onSuccess: (data, variables) => {
      applyResolvedSettings(data);
      toast.push(
        variables.category === "onConversation"
          ? "Audio custom untuk on conversation berhasil diunggah."
          : "Audio custom untuk new messages berhasil diunggah.",
        "success",
      );
    },
    onError: (error) => {
      toast.push(error instanceof ApiError ? error.message : "Gagal mengunggah audio custom.", "error");
    },
  });

  const updateSound = (category: NotificationSoundCategory, value: string) => {
    setForm((current) =>
      category === "onConversation"
        ? { ...current, onConversationSound: value }
        : { ...current, newMessagesSound: value },
    );
  };

  const getPreviewKey = (category: NotificationSoundCategory, soundId: string) => `${category}:${soundId}`;

  const stopPreview = () => {
    if (!previewAudioRef.current) {
      setPreviewingKey(null);
      return;
    }

    previewAudioRef.current.pause();
    previewAudioRef.current.currentTime = 0;
    previewAudioRef.current.onended = null;
    previewAudioRef.current = null;
    setPreviewingKey(null);
  };

  const handlePreview = (category: NotificationSoundCategory, soundId: string) => {
    const nextKey = getPreviewKey(category, soundId);
    if (previewingKey === nextKey) {
      stopPreview();
      return;
    }

    const option = getNotificationSoundOptions(category, form).find((item) => item.id === soundId);
    if (!option) return;

    stopPreview();

    const audio = new Audio(option.src);
    audio.preload = "auto";
    audio.currentTime = 0;
    audio.onended = () => {
      previewAudioRef.current = null;
      setPreviewingKey((current) => (current === nextKey ? null : current));
    };

    previewAudioRef.current = audio;
    setPreviewingKey(nextKey);

    void audio.play().catch(() => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
      }
      setPreviewingKey((current) => (current === nextKey ? null : current));
    });
  };

  const handleCustomUpload = (category: NotificationSoundCategory, file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.push("File harus berupa audio.", "error");
      return;
    }
    uploadMutation.mutate({ category, file });
  };

  return (
    <Card id="notification-preferences" className="p-6">
      <input
        ref={onConversationFileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.wav,.ogg,.m4a,.aac"
        className="hidden"
        onChange={(event) => {
          handleCustomUpload("onConversation", event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={newMessagesFileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.wav,.ogg,.m4a,.aac"
        className="hidden"
        onChange={(event) => {
          handleCustomUpload("newMessages", event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Notifikasi Chat</CardTitle>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            Atur suara notifikasi yang tersimpan pada akun Anda agar respons realtime tetap konsisten di setiap sesi kerja.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      <div className="space-y-3">
        <NotificationPreferenceRow
          id="on-conversation-sound"
          title="On conversation"
          description="Gunakan suara ini untuk pesan baru saat percakapan yang sama masih berlangsung."
          enabled={form.playOnConversationSound}
          value={form.onConversationSound}
          options={getNotificationSoundOptions("onConversation", form)}
          onToggle={(checked) => {
            if (!checked && previewingKey?.startsWith("onConversation:")) {
              stopPreview();
            }
            setForm((current) => ({ ...current, playOnConversationSound: checked }));
          }}
          onChange={(value) => updateSound("onConversation", value)}
          onPreview={() => handlePreview("onConversation", form.onConversationSound)}
          isPreviewing={previewingKey === getPreviewKey("onConversation", form.onConversationSound)}
          onUpload={() => onConversationFileInputRef.current?.click()}
          isUploading={uploadMutation.isPending && uploadMutation.variables?.category === "onConversation"}
          customFileName={form.customOnConversationSound?.name}
          icon={<BellRing className="h-4 w-4" />}
        />

        <NotificationPreferenceRow
          id="new-messages-sound"
          title="New messages"
          description="Gunakan suara ini untuk conversation baru yang masuk ke waiting queue atau inbox tim Anda."
          enabled={form.playNewMessagesSound}
          value={form.newMessagesSound}
          options={getNotificationSoundOptions("newMessages", form)}
          onToggle={(checked) => {
            if (!checked && previewingKey?.startsWith("newMessages:")) {
              stopPreview();
            }
            setForm((current) => ({ ...current, playNewMessagesSound: checked }));
          }}
          onChange={(value) => updateSound("newMessages", value)}
          onPreview={() => handlePreview("newMessages", form.newMessagesSound)}
          isPreviewing={previewingKey === getPreviewKey("newMessages", form.newMessagesSound)}
          onUpload={() => newMessagesFileInputRef.current?.click()}
          isUploading={uploadMutation.isPending && uploadMutation.variables?.category === "newMessages"}
          customFileName={form.customNewMessagesSound?.name}
          icon={<MessageSquareMore className="h-4 w-4" />}
        />
      </div>
    </Card>
  );
}
