import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLeadDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productInterest?: string;

  @IsBoolean()
  consentGiven!: boolean;
}
