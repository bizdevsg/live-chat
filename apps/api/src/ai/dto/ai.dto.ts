import { AI_CHAT_MODELS } from "@solidchat/shared";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateAiConfigurationDto {
  @IsOptional()
  @IsString()
  aiName?: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsIn(AI_CHAT_MODELS)
  model?: (typeof AI_CHAT_MODELS)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AiFeedbackDto {
  @IsBoolean()
  helpful!: boolean;

  @IsOptional()
  @IsBoolean()
  used?: boolean;

  @IsOptional()
  @IsBoolean()
  edited?: boolean;
}
