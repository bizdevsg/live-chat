import { AI_CHAT_MODELS } from "@solidchat/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

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

export class AiKnowledgeTestDto {
  @IsString()
  @MinLength(2, { message: "Pertanyaan test minimal 2 karakter." })
  message!: string;
}

export class WhatsAppAssistantMessageDto {
  @IsIn(["CUSTOMER", "AGENT"])
  senderType!: "CUSTOMER" | "AGENT";

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}

export class WhatsAppAssistantReplyDto {
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsString()
  @MinLength(2, { message: "Prompt minimal 2 karakter." })
  @MaxLength(1000)
  prompt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500000)
  systemPrompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  conversationTitle?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WhatsAppAssistantMessageDto)
  messages!: WhatsAppAssistantMessageDto[];
}
