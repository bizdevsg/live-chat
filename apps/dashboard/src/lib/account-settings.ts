export type NotificationSoundCategory = "onConversation" | "newMessages";
export const CUSTOM_ON_CONVERSATION_SOUND_ID = "custom-on-conversation";
export const CUSTOM_NEW_MESSAGES_SOUND_ID = "custom-new-messages";

export interface NotificationSoundOption {
  id: string;
  label: string;
  src: string;
}

export interface CustomNotificationSound {
  id: string;
  name: string;
  storageKey: string;
}

export interface UserAccountSettings {
  playOnConversationSound: boolean;
  playNewMessagesSound: boolean;
  onConversationSound: string;
  newMessagesSound: string;
  customOnConversationSound: CustomNotificationSound | null;
  customNewMessagesSound: CustomNotificationSound | null;
}

const DEFAULT_ON_CONVERSATION_SOUND_ID = "ding-sound-effect";
const DEFAULT_NEW_MESSAGES_SOUND_ID = "funny-laugh";

export const NOTIFICATION_SOUND_OPTIONS: Record<NotificationSoundCategory, NotificationSoundOption[]> = {
  onConversation: [
    {
      id: "ding-sound-effect",
      label: "Ding Sound Effect",
      src: "/notification/on-conversesion/ding-sound-effect_1_CVUaI0C.mp3",
    },
    {
      id: "y2mate-alert",
      label: "Y2Mate Alert",
      src: "/notification/on-conversesion/y2mate_rQlfs1Y.mp3",
    },
  ],
  newMessages: [
    {
      id: "funny-laugh",
      label: "Funny Laugh",
      src: "/notification/new-massages/funny-sound-that-will-make-you-to-laugh_1.mp3",
    },
    {
      id: "man-snoring-meme",
      label: "Man Snoring Meme",
      src: "/notification/new-massages/man-snoring-meme_ctrllNn.mp3",
    },
  ],
};

export const DEFAULT_USER_ACCOUNT_SETTINGS: UserAccountSettings = {
  playOnConversationSound: true,
  playNewMessagesSound: true,
  onConversationSound: DEFAULT_ON_CONVERSATION_SOUND_ID,
  newMessagesSound: DEFAULT_NEW_MESSAGES_SOUND_ID,
  customOnConversationSound: null,
  customNewMessagesSound: null,
};

function normalizeCustomNotificationSound(value: Partial<CustomNotificationSound> | null | undefined, customId: string): CustomNotificationSound | null {
  if (!value?.name || !value.storageKey) return null;
  return { id: customId, name: value.name, storageKey: value.storageKey };
}

function resolveSoundId(
  category: NotificationSoundCategory,
  soundId: string | null | undefined,
  hasCustomSound: boolean,
) {
  const customId = category === "onConversation" ? CUSTOM_ON_CONVERSATION_SOUND_ID : CUSTOM_NEW_MESSAGES_SOUND_ID;
  if (soundId === customId && hasCustomSound) return customId;
  return NOTIFICATION_SOUND_OPTIONS[category].find((option) => option.id === soundId)?.id ?? DEFAULT_USER_ACCOUNT_SETTINGS[category === "onConversation" ? "onConversationSound" : "newMessagesSound"];
}

export function normalizeUserAccountSettings(value: Partial<UserAccountSettings> | null | undefined): UserAccountSettings {
  const customOnConversationSound = normalizeCustomNotificationSound(value?.customOnConversationSound, CUSTOM_ON_CONVERSATION_SOUND_ID);
  const customNewMessagesSound = normalizeCustomNotificationSound(value?.customNewMessagesSound, CUSTOM_NEW_MESSAGES_SOUND_ID);
  return {
    playOnConversationSound: value?.playOnConversationSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playOnConversationSound,
    playNewMessagesSound: value?.playNewMessagesSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playNewMessagesSound,
    onConversationSound: resolveSoundId("onConversation", value?.onConversationSound, !!customOnConversationSound),
    newMessagesSound: resolveSoundId("newMessages", value?.newMessagesSound, !!customNewMessagesSound),
    customOnConversationSound,
    customNewMessagesSound,
  };
}
