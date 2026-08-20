import { Prisma } from "@solidchat/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_USER_ACCOUNT_SETTINGS,
  NEW_MESSAGES_SOUND_IDS,
  ON_CONVERSATION_SOUND_IDS,
  type NewMessagesSoundId,
  type OnConversationSoundId,
  type UserAccountSettings,
} from "./account-settings.constants";

interface UserAccountSettingsRow {
  playOnConversationSound: boolean | number;
  playNewMessagesSound: boolean | number;
  onConversationSound: string;
  newMessagesSound: string;
}

interface UserAccountSettingsInput {
  playOnConversationSound?: boolean | null;
  playNewMessagesSound?: boolean | null;
  onConversationSound?: string | null;
  newMessagesSound?: string | null;
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

function normalizeOnConversationSound(value: string | null | undefined): OnConversationSoundId {
  return ON_CONVERSATION_SOUND_IDS.includes(value as OnConversationSoundId)
    ? (value as OnConversationSoundId)
    : DEFAULT_USER_ACCOUNT_SETTINGS.onConversationSound;
}

function normalizeNewMessagesSound(value: string | null | undefined): NewMessagesSoundId {
  return NEW_MESSAGES_SOUND_IDS.includes(value as NewMessagesSoundId)
    ? (value as NewMessagesSoundId)
    : DEFAULT_USER_ACCOUNT_SETTINGS.newMessagesSound;
}

export function normalizeUserAccountSettings(input: UserAccountSettingsInput | null | undefined): UserAccountSettings {
  return {
    playOnConversationSound: input?.playOnConversationSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playOnConversationSound,
    playNewMessagesSound: input?.playNewMessagesSound ?? DEFAULT_USER_ACCOUNT_SETTINGS.playNewMessagesSound,
    onConversationSound: normalizeOnConversationSound(input?.onConversationSound),
    newMessagesSound: normalizeNewMessagesSound(input?.newMessagesSound),
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
        new_messages_sound AS newMessagesSound
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
      updated_at
    )
    VALUES (
      ${userId},
      ${settings.playOnConversationSound},
      ${settings.playNewMessagesSound},
      ${settings.onConversationSound},
      ${settings.newMessagesSound},
      CURRENT_TIMESTAMP(3)
    )
    ON DUPLICATE KEY UPDATE
      play_on_conversation_sound = VALUES(play_on_conversation_sound),
      play_new_messages_sound = VALUES(play_new_messages_sound),
      on_conversation_sound = VALUES(on_conversation_sound),
      new_messages_sound = VALUES(new_messages_sound),
      updated_at = CURRENT_TIMESTAMP(3)
  `);
}
