export const ON_CONVERSATION_SOUND_IDS = ["ding-sound-effect", "y2mate-alert"] as const;
export const NEW_MESSAGES_SOUND_IDS = ["funny-laugh", "man-snoring-meme"] as const;

export type OnConversationSoundId = (typeof ON_CONVERSATION_SOUND_IDS)[number];
export type NewMessagesSoundId = (typeof NEW_MESSAGES_SOUND_IDS)[number];

export interface UserAccountSettings {
  playOnConversationSound: boolean;
  playNewMessagesSound: boolean;
  onConversationSound: OnConversationSoundId;
  newMessagesSound: NewMessagesSoundId;
}

export const DEFAULT_USER_ACCOUNT_SETTINGS: UserAccountSettings = {
  playOnConversationSound: true,
  playNewMessagesSound: true,
  onConversationSound: ON_CONVERSATION_SOUND_IDS[0],
  newMessagesSound: NEW_MESSAGES_SOUND_IDS[0],
};

