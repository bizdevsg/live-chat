import { Type } from "class-transformer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { MessageType } from "@solidchat/shared";

class UtmDto {
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() medium?: string;
  @IsOptional() @IsString() campaign?: string;
}

class DeviceDto {
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsInt() screenWidth?: number;
  @IsOptional() @IsInt() screenHeight?: number;
}

export class CreateWidgetSessionDto {
  @IsString()
  siteId!: string;

  @IsString()
  @MaxLength(128)
  visitorId!: string;

  @IsOptional() @IsString() @MaxLength(2048) pageUrl?: string;
  @IsOptional() @IsString() @MaxLength(256) pageTitle?: string;
  @IsOptional() @IsString() @MaxLength(8) language?: string;
  @IsOptional() @IsString() @MaxLength(2048) referrer?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UtmDto)
  utm?: UtmDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: DeviceDto;
}

export class SendWidgetMessageDto {
  @IsString()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsIn([MessageType.TEXT, MessageType.IMAGE, MessageType.FILE, MessageType.QUICK_REPLY])
  messageType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientMessageId?: string;
}

export class RequestAgentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class WidgetFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class IdentifyDto {
  @IsString()
  identityToken!: string;
}

export class UpdateContextDto {
  @IsOptional() @IsString() pageType?: string;
  @IsOptional() @IsString() campaign?: string;
  @IsOptional() @IsString() product?: string;
}
