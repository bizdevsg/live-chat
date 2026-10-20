import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ExtensionSnapshotMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  id!: string;

  @IsIn(["customer", "sales", "ai"])
  senderType!: "customer" | "sales" | "ai";

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;

  @IsISO8601()
  sentAt!: string;
}

export class ExtensionSnapshotLeadDto {
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(500) purpose?: string;
  @IsOptional() @IsString() @MaxLength(120) productInterest?: string;
  @IsOptional() @IsBoolean() consentGiven?: boolean;
}

export class ExtensionSnapshotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  siteId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  conversationId!: string;

  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(255) customerName?: string;
  @IsOptional() @IsEmail() @MaxLength(255) customerEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExtensionSnapshotLeadDto)
  lead?: ExtensionSnapshotLeadDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ExtensionSnapshotMessageDto)
  messages!: ExtensionSnapshotMessageDto[];
}

export const EXTENSION_CHANNELS = ["whatsapp", "instagram", "tiktok"] as const;
export type ExtensionChannel = (typeof EXTENSION_CHANNELS)[number];
