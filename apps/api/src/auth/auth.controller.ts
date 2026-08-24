import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RefreshDto, ResetPasswordDto, UpdateAccountSettingsDto, UploadNotificationSoundDto } from "./dto/auth.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@solidchat/shared";

const REFRESH_COOKIE = "refresh_token";
const ACCESS_COOKIE = "access_token";
const MAX_NOTIFICATION_SOUND_BYTES = 5 * 1024 * 1024;
const ALLOWED_NOTIFICATION_SOUND_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);

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

  @Get("account-settings")
  async accountSettings(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.authService.getAccountSettings(user.sub) };
  }

  @Put("account-settings")
  async updateAccountSettings(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateAccountSettingsDto) {
    return { success: true, data: await this.authService.updateAccountSettings(user.sub, dto) };
  }

  @Post("account-settings/notification-sounds")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_NOTIFICATION_SOUND_BYTES } }))
  async uploadNotificationSound(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UploadNotificationSoundDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("File audio tidak ditemukan pada request.");
    if (!ALLOWED_NOTIFICATION_SOUND_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Format audio tidak didukung. Gunakan MP3, WAV, OGG, M4A, atau AAC.");
    }
    return { success: true, data: await this.authService.uploadNotificationSound(user.sub, dto, file) };
  }

  @Get("account-settings/notification-sounds/:category")
  async notificationSound(
    @CurrentUser() user: JwtAccessPayload,
    @Param("category") category: UploadNotificationSoundDto["category"],
    @Res() res: Response,
  ) {
    if (category !== "onConversation" && category !== "newMessages") {
      throw new BadRequestException("Kategori notifikasi tidak dikenal.");
    }
    const downloadUrl = await this.authService.getNotificationSoundDownloadUrl(user.sub, category);
    return res.redirect(downloadUrl);
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
