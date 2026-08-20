import { IsBoolean, IsOptional, IsString } from "class-validator";

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
