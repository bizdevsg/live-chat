export const ON_CONVERSATION_SOUND_IDS = ["ding-sound-effect", "y2mate-alert"] as const;
export const NEW_MESSAGES_SOUND_IDS = ["funny-laugh", "man-snoring-meme"] as const;
export const CUSTOM_ON_CONVERSATION_SOUND_ID = "custom-on-conversation";
export const CUSTOM_NEW_MESSAGES_SOUND_ID = "custom-new-messages";

export type OnConversationSoundId = (typeof ON_CONVERSATION_SOUND_IDS)[number];
export type NewMessagesSoundId = (typeof NEW_MESSAGES_SOUND_IDS)[number];

export interface CustomNotificationSound {
  id: string;
  name: string;
  storageKey: string;
}

export interface UserAccountSettings {
  playOnConversationSound: boolean;
  playNewMessagesSound: boolean;
  onConversationSound: OnConversationSoundId | typeof CUSTOM_ON_CONVERSATION_SOUND_ID;
  newMessagesSound: NewMessagesSoundId | typeof CUSTOM_NEW_MESSAGES_SOUND_ID;
  customOnConversationSound: CustomNotificationSound | null;
  customNewMessagesSound: CustomNotificationSound | null;
}

export const DEFAULT_USER_ACCOUNT_SETTINGS: UserAccountSettings = {
  playOnConversationSound: true,
  playNewMessagesSound: true,
  onConversationSound: ON_CONVERSATION_SOUND_IDS[0],
  newMessagesSound: NEW_MESSAGES_SOUND_IDS[0],
  customOnConversationSound: null,
  customNewMessagesSound: null,
};
