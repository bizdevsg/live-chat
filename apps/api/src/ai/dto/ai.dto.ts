import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateAiConfigurationDto {
  @IsOptional()
  @IsIn(["mock", "openai"])
  provider?: string;

  @IsOptional()
  @IsString()
  classifierModel?: string;

  @IsOptional()
  @IsString()
  answerModel?: string;

  @IsOptional()
  @IsString()
  summaryModel?: string;

  @IsOptional()
  @IsString()
  suggestedReplyModel?: string;

  @IsOptional()
  @IsString()
  embeddingModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  maxTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries?: number;

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
