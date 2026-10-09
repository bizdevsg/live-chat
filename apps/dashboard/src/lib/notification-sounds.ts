"use client";

import {
  CUSTOM_NEW_MESSAGES_SOUND_ID,
  CUSTOM_ON_CONVERSATION_SOUND_ID,
  DEFAULT_USER_ACCOUNT_SETTINGS,
  NOTIFICATION_SOUND_OPTIONS,
  type NotificationSoundOption,
  type NotificationSoundCategory,
  type UserAccountSettings,
} from "@/lib/account-settings";
import { API_URL } from "@/lib/api-client";

const audioCache = new Map<string, HTMLAudioElement>();
const NEW_MESSAGES_RING_DURATION_MS = 30_000;
let notificationAudioPrepared = false;
let notificationAudioUnlocked = false;
let pendingPlayback: { category: NotificationSoundCategory; soundId: string } | null = null;
let latestNotificationSettings: UserAccountSettings | null = null;
let newMessagesAudio: HTMLAudioElement | null = null;
let newMessagesStopTimer: number | null = null;
let newMessagesPlaybackVersion = 0;

export function stopNewMessagesNotificationSound() {
  if (typeof window === "undefined") return;
  newMessagesPlaybackVersion += 1;
  if (newMessagesStopTimer !== null) {
    window.clearTimeout(newMessagesStopTimer);
    newMessagesStopTimer = null;
  }
  if (!newMessagesAudio) return;
  newMessagesAudio.pause();
  newMessagesAudio.currentTime = 0;
  newMessagesAudio.loop = false;
  newMessagesAudio = null;
}

function getOrCreateCachedAudio(src: string) {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(src, audio);
  }

  return audio;
}

function buildCustomNotificationSoundOption(category: NotificationSoundCategory, settings: UserAccountSettings | null | undefined): NotificationSoundOption | null {
  const customSound = category === "onConversation" ? settings?.customOnConversationSound : settings?.customNewMessagesSound;
  if (!customSound) return null;

  return {
    id: category === "onConversation" ? CUSTOM_ON_CONVERSATION_SOUND_ID : CUSTOM_NEW_MESSAGES_SOUND_ID,
    label: `Custom - ${customSound.name}`,
    src: `${API_URL}/api/v1/auth/account-settings/notification-sounds/${category}?v=${encodeURIComponent(customSound.storageKey)}`,
  };
}

function resolveSoundOption(category: NotificationSoundCategory, soundId: string, settings?: UserAccountSettings | null) {
  const options = getNotificationSoundOptions(category, settings);
  const matchedOption = options.find((option) => option.id === soundId);
  if (matchedOption) return matchedOption;

  const fallbackOption = options[0];
  if (!fallbackOption) {
    throw new Error(`Missing notification sound options for category: ${category}`);
  }

  return fallbackOption;
}

export function getNotificationSoundOptions(category: NotificationSoundCategory, settings?: UserAccountSettings | null) {
  const customOption = buildCustomNotificationSoundOption(category, settings);
  return customOption ? [...NOTIFICATION_SOUND_OPTIONS[category], customOption] : NOTIFICATION_SOUND_OPTIONS[category];
}

export function prepareNotificationSounds(settings?: UserAccountSettings | null) {
  if (typeof window === "undefined") return () => undefined;
  latestNotificationSettings = settings ?? DEFAULT_USER_ACCOUNT_SETTINGS;
  if (!latestNotificationSettings.playNewMessagesSound) {
    stopNewMessagesNotificationSound();
  }

  const allOptions = [
    ...getNotificationSoundOptions("onConversation", settings),
    ...getNotificationSoundOptions("newMessages", settings),
  ];

  for (const option of allOptions) {
    getOrCreateCachedAudio(option.src);
  }

  if (notificationAudioPrepared) return () => undefined;
  notificationAudioPrepared = true;

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
          playNotificationSound(queuedPlayback.category, queuedPlayback.soundId, latestNotificationSettings);
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
    playNotificationSound(queuedPlayback.category, queuedPlayback.soundId, latestNotificationSettings);
  };

  const handleInteraction = () => {
    onFirstInteraction();
    onRetryInteraction();
  };

  const handleVisible = () => {
    if (document.visibilityState !== "visible") return;
    for (const audio of audioCache.values()) {
      try {
        audio.load();
      } catch {
        // Ignore load errors until playback is attempted.
      }
    }
    unlockAudio();
  };

  if (document.visibilityState === "visible") {
    handleVisible();
  }

  window.addEventListener("pointerdown", handleInteraction, { passive: true });
  window.addEventListener("keydown", handleInteraction);
  document.addEventListener("visibilitychange", handleVisible);

  // These listeners intentionally live for the dashboard session. React reruns this
  // setup after account settings load; removing them during that rerun could leave
  // audio permanently locked until the page is reloaded.
  return () => undefined;
}

function playNotificationSound(category: NotificationSoundCategory, soundId: string, settings?: UserAccountSettings | null) {
  if (typeof window === "undefined") return;

  const option = resolveSoundOption(category, soundId, settings);
  const audio = getOrCreateCachedAudio(option.src);

  if (category === "newMessages") {
    if (newMessagesAudio && newMessagesAudio !== audio) {
      stopNewMessagesNotificationSound();
    }

    const playbackVersion = ++newMessagesPlaybackVersion;
    newMessagesAudio = audio;
    audio.muted = false;
    audio.loop = true;
    if (newMessagesStopTimer !== null) {
      window.clearTimeout(newMessagesStopTimer);
      newMessagesStopTimer = null;
    }

    const scheduleStop = () => {
      if (playbackVersion !== newMessagesPlaybackVersion || newMessagesAudio !== audio) return;
      newMessagesStopTimer = window.setTimeout(() => {
        if (playbackVersion === newMessagesPlaybackVersion) stopNewMessagesNotificationSound();
      }, NEW_MESSAGES_RING_DURATION_MS);
    };

    if (!audio.paused) {
      scheduleStop();
      return;
    }

    audio.currentTime = 0;
    void audio.play()
      .then(scheduleStop)
      .catch(() => {
        if (playbackVersion === newMessagesPlaybackVersion) {
          audio.loop = false;
          newMessagesAudio = null;
        }
        pendingPlayback = { category, soundId };
      });
    return;
  }

  audio.loop = false;
  audio.muted = false;
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {
    pendingPlayback = { category, soundId };
  });
}

function resolveNotificationSoundCategory(type: string | undefined): NotificationSoundCategory | null {
  if (type === "NEW_WAITING_CONVERSATION" || type === "NEW_INBOX_CONVERSATION" || type === "AGENT_TRANSFER") return "newMessages";
  if (type === "NEW_CUSTOMER_MESSAGE") return "onConversation";
  return null;
}

export function playNotificationSoundForType(type: string | undefined, settings: UserAccountSettings | null | undefined) {
  const category = resolveNotificationSoundCategory(type);
  if (!category) return;

  const resolvedSettings = settings ?? DEFAULT_USER_ACCOUNT_SETTINGS;

  if (category === "onConversation") {
    if (!resolvedSettings.playOnConversationSound) return;
    playNotificationSound(category, resolvedSettings.onConversationSound, resolvedSettings);
    return;
  }

  if (!resolvedSettings.playNewMessagesSound) {
    stopNewMessagesNotificationSound();
    return;
  }
  playNotificationSound(category, resolvedSettings.newMessagesSound, resolvedSettings);
}
