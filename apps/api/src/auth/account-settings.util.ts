import { Prisma } from "@solidchat/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  CUSTOM_NEW_MESSAGES_SOUND_ID,
  CUSTOM_ON_CONVERSATION_SOUND_ID,
  DEFAULT_USER_ACCOUNT_SETTINGS,
  NEW_MESSAGES_SOUND_IDS,
  ON_CONVERSATION_SOUND_IDS,
  type CustomNotificationSound,
  type NewMessagesSoundId,
  type OnConversationSoundId,
  type UserAccountSettings,
} from "./account-settings.constants";

interface UserAccountSettingsRow {
  playOnConversationSound: boolean | number;
  playNewMessagesSound: boolean | number;
  onConversationSound: string;
  newMessagesSound: string;
  customOnConversationSoundName: string | null;
  customOnConversationSoundStorageKey: string | null;
  customNewMessagesSoundName: string | null;
  customNewMessagesSoundStorageKey: string | null;
}

interface UserAccountSettingsInput {
  playOnConversationSound?: boolean | null;
  playNewMessagesSound?: boolean | null;
  onConversationSound?: string | null;
  newMessagesSound?: string | null;
  customOnConversationSound?: CustomNotificationSound | null;
  customNewMessagesSound?: CustomNotificationSound | null;
}

function isMissingAccountSettingsTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    typeof error.message === "string" &&
    error.message.includes("user_account_settings")
  );
}

function normalizeBoolean(value: boolean | number | null | undefined) {
  return value === true || value === 1;
}

function normalizeCustomSound(value: CustomNotificationSound | null | undefined): CustomNotificationSound | null {
  if (!value?.name || !value.storageKey) return null;
  return { id: value.id, name: value.name, storageKey: value.storageKey };
}

function normalizeOnConversationSound(
  value: string | null | undefined,
  customOnConversationSound: CustomNotificationSound | null | undefined,
): OnConversationSoundId | typeof CUSTOM_ON_CONVERSATION_SOUND_ID {
  return ON_CONVERSATION_SOUND_IDS.includes(value as OnConversationSoundId)
    ? (value as OnConversationSoundId)
    : value === CUSTOM_ON_CONVERSATION_SOUND_ID && customOnConversationSound
      ? CUSTOM_ON_CONVERSATION_SOUND_ID
    : DEFAULT_USER_ACCOUNT_SETTINGS.onConversationSound;
}

function normalizeNewMessagesSound(
  value: string | null | undefined,
  customNewMessagesSound: CustomNotificationSound | null | undefined,
): NewMessagesSoundId | typeof CUSTOM_NEW_MESSAGES_SOUND_ID {
  return NEW_MESSAGES_SOUND_IDS.includes(value as NewMessagesSoundId)
    ? (value as NewMessagesSoundId)
    : value === CUSTOM_NEW_MESSAGES_SOUND_ID && customNewMessagesSound
      ? CUSTOM_NEW_MESSAGES_SOUND_ID
    : DEFAULT_USER_ACCOUNT_SETTINGS.newMessagesSound;
}

export function normalizeUserAccountSettings(input: UserAccountSettingsInput | null | undefined): UserAccountSettings {
  const customOnConversationSound = normalizeCustomSound(input?.customOnConversationSound);
  const customNewMessagesSound = normalizeCustomSound(input?.customNewMessagesSound);
  return {
    playOnConversationSound: input?.playOnConversationSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playOnConversationSound,
    playNewMessagesSound: input?.playNewMessagesSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playNewMessagesSound,
    onConversationSound: normalizeOnConversationSound(input?.onConversationSound, customOnConversationSound),
    newMessagesSound: normalizeNewMessagesSound(input?.newMessagesSound, customNewMessagesSound),
    customOnConversationSound,
    customNewMessagesSound,
  };
}

export async function loadUserAccountSettings(prisma: PrismaService, userId: string): Promise<UserAccountSettings> {
  let rows: UserAccountSettingsRow[];
  try {
    rows = await prisma.$queryRaw<UserAccountSettingsRow[]>(Prisma.sql`
      SELECT
        play_on_conversation_sound AS playOnConversationSound,
        play_new_messages_sound AS playNewMessagesSound,
        on_conversation_sound AS onConversationSound,
        new_messages_sound AS newMessagesSound,
        custom_on_conversation_sound_name AS customOnConversationSoundName,
        custom_on_conversation_sound_storage_key AS customOnConversationSoundStorageKey,
        custom_new_messages_sound_name AS customNewMessagesSoundName,
        custom_new_messages_sound_storage_key AS customNewMessagesSoundStorageKey
      FROM user_account_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `);
  } catch (error) {
    if (isMissingAccountSettingsTableError(error)) return DEFAULT_USER_ACCOUNT_SETTINGS;
    throw error;
  }

  const row = rows[0];
  if (!row) return DEFAULT_USER_ACCOUNT_SETTINGS;

  return normalizeUserAccountSettings({
    playOnConversationSound: normalizeBoolean(row.playOnConversationSound),
    playNewMessagesSound: normalizeBoolean(row.playNewMessagesSound),
    onConversationSound: row.onConversationSound,
    newMessagesSound: row.newMessagesSound,
    customOnConversationSound:
      row.customOnConversationSoundName && row.customOnConversationSoundStorageKey
        ? {
            id: CUSTOM_ON_CONVERSATION_SOUND_ID,
            name: row.customOnConversationSoundName,
            storageKey: row.customOnConversationSoundStorageKey,
          }
        : null,
    customNewMessagesSound:
      row.customNewMessagesSoundName && row.customNewMessagesSoundStorageKey
        ? {
            id: CUSTOM_NEW_MESSAGES_SOUND_ID,
            name: row.customNewMessagesSoundName,
            storageKey: row.customNewMessagesSoundStorageKey,
          }
        : null,
  });
}

export async function upsertUserAccountSettings(prisma: PrismaService, userId: string, settings: UserAccountSettings): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO user_account_settings (
      user_id,
      play_on_conversation_sound,
      play_new_messages_sound,
      on_conversation_sound,
      new_messages_sound,
      custom_on_conversation_sound_name,
      custom_on_conversation_sound_storage_key,
      custom_new_messages_sound_name,
      custom_new_messages_sound_storage_key,
      updated_at
    )
    VALUES (
      ${userId},
      ${settings.playOnConversationSound},
      ${settings.playNewMessagesSound},
      ${settings.onConversationSound},
      ${settings.newMessagesSound},
      ${settings.customOnConversationSound?.name ?? null},
      ${settings.customOnConversationSound?.storageKey ?? null},
      ${settings.customNewMessagesSound?.name ?? null},
      ${settings.customNewMessagesSound?.storageKey ?? null},
      CURRENT_TIMESTAMP(3)
    )
    ON DUPLICATE KEY UPDATE
      play_on_conversation_sound = VALUES(play_on_conversation_sound),
      play_new_messages_sound = VALUES(play_new_messages_sound),
      on_conversation_sound = VALUES(on_conversation_sound),
      new_messages_sound = VALUES(new_messages_sound),
      custom_on_conversation_sound_name = VALUES(custom_on_conversation_sound_name),
      custom_on_conversation_sound_storage_key = VALUES(custom_on_conversation_sound_storage_key),
      custom_new_messages_sound_name = VALUES(custom_new_messages_sound_name),
      custom_new_messages_sound_storage_key = VALUES(custom_new_messages_sound_storage_key),
      updated_at = CURRENT_TIMESTAMP(3)
  `);
}
