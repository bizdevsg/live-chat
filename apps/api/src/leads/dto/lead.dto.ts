import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLeadDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

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

  // Accepted but unused: older widget builds still POST a department picker value.
  // Whitelisting it here stops those clients from failing the forbidNonWhitelisted check.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  departmentId?: string;

  @IsBoolean()
  consentGiven!: boolean;
}
