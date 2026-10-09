import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@solidchat/shared";
import {
  CUSTOM_NEW_MESSAGES_SOUND_ID,
  CUSTOM_ON_CONVERSATION_SOUND_ID,
  NEW_MESSAGES_SOUND_IDS,
  ON_CONVERSATION_SOUND_IDS,
} from "../account-settings.constants";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  // Optional: the dashboard relies on the httpOnly refresh_token cookie and sends no body;
  // the widget (which has no cookie) can pass it explicitly instead.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: "Password saat ini wajib diisi." })
  @MaxLength(512, { message: "Password saat ini terlalu panjang." })
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: "Password baru minimal 8 karakter." })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: "Password baru maksimal 64 karakter." })
  @Matches(PASSWORD_COMPLEXITY_PATTERN, { message: PASSWORD_COMPLEXITY_MESSAGE })
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: "Password minimal 8 karakter." })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: "Password maksimal 64 karakter." })
  @Matches(PASSWORD_COMPLEXITY_PATTERN, { message: PASSWORD_COMPLEXITY_MESSAGE })
  newPassword!: string;
}

export class UpdateAccountSettingsDto {
  @IsOptional()
  @IsBoolean()
  playOnConversationSound?: boolean;

  @IsOptional()
  @IsBoolean()
  playNewMessagesSound?: boolean;

  @IsOptional()
  @IsString()
  @IsIn([...ON_CONVERSATION_SOUND_IDS, CUSTOM_ON_CONVERSATION_SOUND_ID])
  onConversationSound?: string;

  @IsOptional()
  @IsString()
  @IsIn([...NEW_MESSAGES_SOUND_IDS, CUSTOM_NEW_MESSAGES_SOUND_ID])
  newMessagesSound?: string;
}

export class UploadNotificationSoundDto {
  @IsString()
  @IsIn(["onConversation", "newMessages"])
  category!: "onConversation" | "newMessages";
}
