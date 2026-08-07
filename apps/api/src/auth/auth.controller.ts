import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RefreshDto, ResetPasswordDto } from "./dto/auth.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@solidchat/shared";

const REFRESH_COOKIE = "refresh_token";
const ACCESS_COOKIE = "access_token";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto.email, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { success: true, data: { expiresIn: tokens.expiresIn } };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = dto.refreshToken || req.cookies?.[REFRESH_COOKIE];
    const tokens = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { success: true, data: { expiresIn: tokens.expiresIn } };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: JwtAccessPayload, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sessionId);
    this.clearCookies(res);
    return { success: true, data: null };
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: JwtAccessPayload, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(user.sub);
    this.clearCookies(res);
    return { success: true, data: null };
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { success: true, data: null };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true, data: null };
  }

  @Get("me")
  async me(@CurrentUser() user: JwtAccessPayload) {
    const context = await this.authService.me(user.sub);
    return { success: true, data: context };
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.config.get("NODE_ENV") === "production";
    const domain = this.config.get<string>("COOKIE_DOMAIN");
    const common = { httpOnly: true, secure: isProd, sameSite: "lax" as const, domain };
    res.cookie(ACCESS_COOKIE, accessToken, { ...common, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 30 * 24 * 60 * 60 * 1000, path: "/api/v1/auth" });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  }
}
