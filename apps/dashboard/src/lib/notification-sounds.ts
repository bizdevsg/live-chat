"use client";

import {
  DEFAULT_USER_ACCOUNT_SETTINGS,
  NOTIFICATION_SOUND_OPTIONS,
  type NotificationSoundCategory,
  type UserAccountSettings,
} from "@/lib/account-settings";

const audioCache = new Map<string, HTMLAudioElement>();
let notificationAudioPrepared = false;
let notificationAudioUnlocked = false;
let pendingPlayback: { category: NotificationSoundCategory; soundId: string } | null = null;

function getOrCreateCachedAudio(src: string) {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(src, audio);
  }

  return audio;
}

function resolveSoundOption(category: NotificationSoundCategory, soundId: string) {
  const options = NOTIFICATION_SOUND_OPTIONS[category];
  const matchedOption = options.find((option) => option.id === soundId);
  if (matchedOption) return matchedOption;

  const fallbackOption = options[0];
  if (!fallbackOption) {
    throw new Error(`Missing notification sound options for category: ${category}`);
  }

  return fallbackOption;
}

export function getNotificationSoundOptions(category: NotificationSoundCategory) {
  return NOTIFICATION_SOUND_OPTIONS[category];
}

export function prepareNotificationSounds() {
  if (typeof window === "undefined" || notificationAudioPrepared) return () => undefined;
  notificationAudioPrepared = true;

  const allOptions = [...NOTIFICATION_SOUND_OPTIONS.onConversation, ...NOTIFICATION_SOUND_OPTIONS.newMessages];

  for (const option of allOptions) {
    getOrCreateCachedAudio(option.src);
  }

  const unlockAudio = () => {
    if (notificationAudioUnlocked) return;

    const primer = allOptions[0];
    if (!primer) return;

    const audio = getOrCreateCachedAudio(primer.src);
    audio.muted = true;
    void audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        notificationAudioUnlocked = true;

        if (pendingPlayback) {
          const queuedPlayback = pendingPlayback;
          pendingPlayback = null;
          playNotificationSound(queuedPlayback.category, queuedPlayback.soundId);
        }
      })
      .catch(() => {
        audio.muted = false;
      });
  };

  const onFirstInteraction = () => {
    unlockAudio();
  };

  const onRetryInteraction = () => {
    if (!pendingPlayback) return;
    const queuedPlayback = pendingPlayback;
    pendingPlayback = null;
    playNotificationSound(queuedPlayback.category, queuedPlayback.soundId);
  };

  const handleInteraction = () => {
    onFirstInteraction();
    onRetryInteraction();
  };

  if (document.visibilityState === "visible") {
    for (const audio of audioCache.values()) {
      try {
        audio.load();
      } catch {
        // Ignore load errors until playback is attempted.
      }
    }
  }

  window.addEventListener("pointerdown", handleInteraction, { passive: true });
  window.addEventListener("keydown", handleInteraction);

  return () => {
    window.removeEventListener("pointerdown", handleInteraction);
    window.removeEventListener("keydown", handleInteraction);
  };
}

export function playNotificationSound(category: NotificationSoundCategory, soundId: string) {
  if (typeof window === "undefined") return;

  const option = resolveSoundOption(category, soundId);
  getOrCreateCachedAudio(option.src);

  const audio = new Audio(option.src);
  audio.preload = "auto";
  audio.currentTime = 0;
  void audio.play().catch(() => {
    pendingPlayback = { category, soundId };
  });
}

export function resolveNotificationSoundCategory(type: string | undefined): NotificationSoundCategory | null {
  if (type === "NEW_INBOX_CONVERSATION" || type === "NEW_WAITING_CONVERSATION") return "newMessages";
  if (type === "NEW_CUSTOMER_MESSAGE") return "onConversation";
  return null;
}

export function playNotificationSoundForType(type: string | undefined, settings: UserAccountSettings | null | undefined) {
  const category = resolveNotificationSoundCategory(type);
  if (!category) return;

  const resolvedSettings = settings ?? DEFAULT_USER_ACCOUNT_SETTINGS;

  if (category === "onConversation") {
    if (!resolvedSettings.playOnConversationSound) return;
    playNotificationSound(category, resolvedSettings.onConversationSound);
    return;
  }

  if (!resolvedSettings.playNewMessagesSound) return;
  playNotificationSound(category, resolvedSettings.newMessagesSound);
}
