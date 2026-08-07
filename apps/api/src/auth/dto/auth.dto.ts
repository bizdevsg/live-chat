import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  // Optional: the dashboard relies on the httpOnly refresh_token cookie and sends no body;
  // the widget (which has no cookie) can pass it explicitly instead.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10, { message: "Password minimal 10 karakter." })
  @Matches(/[a-z]/, { message: "Password harus mengandung huruf kecil." })
  @Matches(/[A-Z]/, { message: "Password harus mengandung huruf besar." })
  @Matches(/[0-9]/, { message: "Password harus mengandung angka." })
  newPassword!: string;
}
