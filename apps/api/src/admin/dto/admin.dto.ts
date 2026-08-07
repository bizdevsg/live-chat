import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  roleSlugs!: string[];

  @IsOptional()
  @IsString()
  teamId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roleSlugs?: string[];
  @IsOptional() @IsString() supervisorId?: string;
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  roleSlug!: string;
}

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) capacityPerAgent?: number;
  @IsOptional() @IsInt() routingPriority?: number;
  @IsOptional() @IsString() supervisorId?: string;
}

export class UpdateTeamDto extends CreateTeamDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TeamMemberDto {
  @IsString()
  userId!: string;
}

export class CreateSiteDto {
  @IsString() siteKey!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() aiName?: string;
  @IsOptional() @IsString() greeting?: string;
  @IsOptional() @IsString() offlineMessage?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() widgetColor?: string;
}

export class UpdateSiteDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() aiName?: string;
  @IsOptional() @IsString() greeting?: string;
  @IsOptional() @IsString() offlineMessage?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() widgetColor?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddDomainDto {
  @IsString()
  domain!: string;
}

export class UpdateWidgetSettingsDto {
  @IsOptional() @IsBoolean() widgetEnabled?: boolean;
  @IsOptional() @IsBoolean() aiEnabled?: boolean;
  @IsOptional() @IsBoolean() humanChatEnabled?: boolean;
  @IsOptional() @IsIn(["bottom-right", "bottom-left"]) bubblePosition?: string;
  @IsOptional() @IsBoolean() preChatFormEnabled?: boolean;
  @IsOptional() @IsObject() preChatFormFields?: object;
  @IsOptional() @IsObject() quickReplies?: object;
  @IsOptional() @IsObject() suggestedQuestions?: object;
  @IsOptional() @IsBoolean() showAgentButton?: boolean;
  @IsOptional() @IsBoolean() allowAttachments?: boolean;
  @IsOptional() @IsArray() allowedFileTypes?: string[];
  @IsOptional() @IsInt() maxFileSizeBytes?: number;
  @IsOptional() @IsString() privacyNoticeUrl?: string;
  @IsOptional() @IsString() termsUrl?: string;
  @IsOptional() @IsBoolean() ratingFormEnabled?: boolean;
  @IsOptional() @IsBoolean() showAiSourcesToCustomer?: boolean;
}

class RuleConditionsDto {
  @IsOptional() @IsString() intent?: string;
}

export class CreateRoutingRuleDto {
  @IsString() name!: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => RuleConditionsDto) conditions?: RuleConditionsDto;
  @IsOptional() @IsString() targetTeamId?: string;
  @IsOptional() @IsIn(["ROUND_ROBIN", "LEAST_ACTIVE", "MANUAL", "SKILL_BASED", "PRIORITY_BASED"]) strategy?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateHandoffRuleDto {
  @IsString() reason!: string;
  @IsOptional() @IsString() targetTeamId?: string;
  @IsOptional() @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"]) priority?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateTemplateDto {
  @IsString() shortcut!: string;
  @IsString() title!: string;
  @IsString() content!: string;
  @IsOptional() @IsString() language?: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() language?: string;
}
