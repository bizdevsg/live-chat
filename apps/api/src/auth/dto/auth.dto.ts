import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";
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

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10, { message: "Password minimal 10 karakter." })
  @Matches(/[a-z]/, { message: "Password harus mengandung huruf kecil." })
  @Matches(/[A-Z]/, { message: "Password harus mengandung huruf besar." })
  @Matches(/[0-9]/, { message: "Password harus mengandung angka." })
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
