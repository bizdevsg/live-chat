import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RefreshDto, ResetPasswordDto, UpdateAccountSettingsDto, UpdateProfileDto, UploadNotificationSoundDto } from "./dto/auth.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@solidchat/shared";
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "./auth-cookies.util";
import { AgentService } from "../agent/agent.service";

const MAX_NOTIFICATION_SOUND_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
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
    private readonly agentService: AgentService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto.email, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(req, res, this.config, tokens.accessToken, tokens.refreshToken);
    return { success: true, data: tokens };
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
    setAuthCookies(req, res, this.config, tokens.accessToken, tokens.refreshToken);
    return { success: true, data: tokens };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: JwtAccessPayload, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sessionId);
    clearAuthCookies(req, res, this.config);
    // Best-effort — a logout must never fail because presence bookkeeping hiccuped.
    this.agentService.markOfflineOnLogout(user.sub, user.organizationId).catch(() => undefined);
    return { success: true, data: null };
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: JwtAccessPayload, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(user.sub);
    clearAuthCookies(req, res, this.config);
    this.agentService.markOfflineOnLogout(user.sub, user.organizationId).catch(() => undefined);
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

  @Put("profile")
  async updateProfile(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateProfileDto) {
    return { success: true, data: await this.authService.updateProfile(user.sub, dto) };
  }

  @Post("profile/avatar")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_AVATAR_BYTES } }))
  async uploadAvatar(@CurrentUser() user: JwtAccessPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("File foto tidak ditemukan pada request.");
    return { success: true, data: await this.authService.uploadAvatar(user.sub, file) };
  }

  // Returns the signed URL as JSON rather than redirecting: a plain <img src> can't attach the
  // dashboard's Bearer token (it authenticates via header, not the access-token cookie — the
  // notification-sound GET above relies on that cookie and is not a safe pattern to copy). The
  // client fetches this authenticated endpoint first, then points <img> at the resulting MinIO
  // URL directly, same as chat image attachments already do.
  @Get("profile/avatar")
  async avatar(@CurrentUser() user: JwtAccessPayload) {
    const url = await this.authService.getAvatarDownloadUrl(user.sub);
    return { success: true, data: { url } };
  }

  @Delete("profile/avatar")
  async removeAvatar(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.authService.removeAvatar(user.sub) };
  }
}
