"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";
import { DEFAULT_USER_ACCOUNT_SETTINGS, normalizeUserAccountSettings, type NotificationSoundCategory, type UserAccountSettings } from "@/lib/account-settings";
import { getNotificationSoundOptions, playNotificationSound } from "@/lib/notification-sounds";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";

export function AccountSettingsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState<UserAccountSettings>(user?.accountSettings ?? DEFAULT_USER_ACCOUNT_SETTINGS);

  const settingsQuery = useQuery({
    queryKey: ["auth", "account-settings"],
    queryFn: () => apiClient.get<UserAccountSettings>("/api/v1/auth/account-settings"),
    initialData: user?.accountSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) setForm(normalizeUserAccountSettings(settingsQuery.data));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.put<UserAccountSettings>("/api/v1/auth/account-settings", form),
    onSuccess: (data) => {
      const normalized = normalizeUserAccountSettings(data);
      setForm(normalized);
      queryClient.setQueryData(["auth", "account-settings"], normalized);
      queryClient.setQueryData<AuthUser | undefined>(["auth", "me"], (current) =>
        current ? { ...current, accountSettings: normalized } : current,
      );
      if (user) setUser({ ...user, accountSettings: normalized });
      toast.push("Pengaturan notifikasi berhasil disimpan.", "success");
    },
    onError: (error) => {
      toast.push(error instanceof ApiError ? error.message : "Gagal menyimpan pengaturan notifikasi.", "error");
    },
  });

  const updateSound = (category: NotificationSoundCategory, value: string) => {
    setForm((current) =>
      category === "onConversation"
        ? { ...current, onConversationSound: value }
        : { ...current, newMessagesSound: value },
    );
  };

  return (
    <Card>
      <CardHeader className="items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Notifikasi Chat</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">
            Preferensi ini tersimpan per akun admin dan dipakai langsung saat notifikasi realtime masuk.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Simpan perubahan
        </Button>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-ink-700 bg-ink-900/30 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="on-conversation-sound">On-conversession</Label>
              <p className="mt-1 text-xs text-zinc-500">Untuk pesan baru saat percakapan yang sama sedang berlangsung.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={form.playOnConversationSound}
                onChange={(event) => setForm((current) => ({ ...current, playOnConversationSound: event.target.checked }))}
                className="h-4 w-4 rounded border-ink-500 bg-ink-800 text-gold-500 focus:ring-gold-500"
              />
              Aktif
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              id="on-conversation-sound"
              value={form.onConversationSound}
              onChange={(event) => updateSound("onConversation", event.target.value)}
              disabled={!form.playOnConversationSound}
            >
              {getNotificationSoundOptions("onConversation").map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="sm:w-auto"
              onClick={() => playNotificationSound("onConversation", form.onConversationSound)}
            >
              Preview
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/30 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="new-messages-sound">New-massages</Label>
              <p className="mt-1 text-xs text-zinc-500">Untuk conversation baru yang baru dibuat atau masuk ke waiting queue/inbox.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={form.playNewMessagesSound}
                onChange={(event) => setForm((current) => ({ ...current, playNewMessagesSound: event.target.checked }))}
                className="h-4 w-4 rounded border-ink-500 bg-ink-800 text-gold-500 focus:ring-gold-500"
              />
              Aktif
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              id="new-messages-sound"
              value={form.newMessagesSound}
              onChange={(event) => updateSound("newMessages", event.target.value)}
              disabled={!form.playNewMessagesSound}
            >
              {getNotificationSoundOptions("newMessages").map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="sm:w-auto"
              onClick={() => playNotificationSound("newMessages", form.newMessagesSound)}
            >
              Preview
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
