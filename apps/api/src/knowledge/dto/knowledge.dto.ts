import { Type } from "class-transformer";
import { IsArray, IsIn, IsISO8601, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { KnowledgeAudience } from "@solidchat/shared";

export class CreateKnowledgeDocumentDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(20, { message: "Isi artikel minimal 20 karakter." })
  content!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(Object.values(KnowledgeAudience))
  audience?: string;

  @IsOptional()
  @IsISO8601()
  effectiveDate?: string;

  @IsOptional()
  @IsISO8601()
  expiredDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateKnowledgeDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  content?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(Object.values(KnowledgeAudience))
  audience?: string;

  @IsOptional()
  @IsISO8601()
  effectiveDate?: string;

  @IsOptional()
  @IsISO8601()
  expiredDate?: string;
}

export class ListKnowledgeQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(Object.values(KnowledgeAudience))
  audience?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
