export type NotificationSoundCategory = "onConversation" | "newMessages";

export interface NotificationSoundOption {
  id: string;
  label: string;
  src: string;
}

export interface UserAccountSettings {
  playOnConversationSound: boolean;
  playNewMessagesSound: boolean;
  onConversationSound: string;
  newMessagesSound: string;
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
};

function resolveSoundId(category: NotificationSoundCategory, soundId: string | null | undefined) {
  return NOTIFICATION_SOUND_OPTIONS[category].find((option) => option.id === soundId)?.id ?? DEFAULT_USER_ACCOUNT_SETTINGS[category === "onConversation" ? "onConversationSound" : "newMessagesSound"];
}

export function normalizeUserAccountSettings(value: Partial<UserAccountSettings> | null | undefined): UserAccountSettings {
  return {
    playOnConversationSound: value?.playOnConversationSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playOnConversationSound,
    playNewMessagesSound: value?.playNewMessagesSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playNewMessagesSound,
    onConversationSound: resolveSoundId("onConversation", value?.onConversationSound),
    newMessagesSound: resolveSoundId("newMessages", value?.newMessagesSound),
  };
}
