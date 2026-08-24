import { BadRequestException, Injectable, HttpStatus, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import type { JwtAccessPayload, JwtRefreshPayload } from "@solidchat/shared";
import { ErrorCode } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { SecurityEventService } from "../common/security/security-event.service";
import { ApiException, UnauthorizedApiException } from "../common/errors/api.exception";
import { StorageService } from "../storage/storage.service";
import { loadUserAuthContext } from "./auth-context.util";
import type { UpdateAccountSettingsDto, UploadNotificationSoundDto } from "./dto/auth.dto";
import {
  CUSTOM_NEW_MESSAGES_SOUND_ID,
  CUSTOM_ON_CONVERSATION_SOUND_ID,
} from "./account-settings.constants";
import { normalizeUserAccountSettings, upsertUserAccountSettings } from "./account-settings.util";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly securityEvents: SecurityEventService,
    private readonly storage: StorageService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({ where: { email } });

    if (!user) {
      await this.securityEvents.record({ type: "FAILED_LOGIN", ipAddress: meta.ipAddress, details: { email } });
      throw new UnauthorizedApiException("Email atau password salah.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiException(
        ErrorCode.ACCOUNT_LOCKED,
        "Akun terkunci sementara karena percobaan login yang gagal. Coba lagi nanti.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.isActive) {
      throw new ApiException(ErrorCode.ACCOUNT_DISABLED, "Akun dinonaktifkan.", HttpStatus.FORBIDDEN);
    }

    const passwordValid = await verify(user.passwordHash, password);
    if (!passwordValid) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
        },
      });
      await this.securityEvents.record({
        organizationId: user.organizationId,
        type: shouldLock ? "ACCOUNT_LOCKED" : "FAILED_LOGIN",
        severity: shouldLock ? "MEDIUM" : "LOW",
        actorId: user.id,
        ipAddress: meta.ipAddress,
      });
      throw new UnauthorizedApiException("Email atau password salah.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, meta);

    await this.auditLog.record({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      action: "auth.login",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedApiException("Refresh token tidak valid atau kedaluwarsa.");
    }
    if (payload.type !== "refresh") throw new UnauthorizedApiException("Tipe token tidak valid.");

    const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedApiException("Sesi tidak ditemukan atau telah berakhir.");
    }

    const incomingHash = hashToken(refreshToken);
    if (incomingHash !== session.refreshHash) {
      // Reused/stolen refresh token detected — revoke the entire token family (§31 rotation).
      await this.prisma.session.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: new Date() },
      });
      await this.securityEvents.record({
        type: "FAILED_LOGIN",
        severity: "HIGH",
        actorId: session.userId,
        ipAddress: meta.ipAddress,
        details: { reason: "refresh_token_reuse_detected" },
      });
      throw new UnauthorizedApiException("Sesi tidak valid. Silakan login kembali.");
    }

    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(session.userId, meta, session.tokenFamily);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }).catch(() => undefined);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) return; // do not reveal whether the email exists

    const rawToken = nanoid(32);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // Email delivery is out of scope for this build (no SMTP configured) — the reset
    // link is logged server-side only, never returned in the API response.
    console.log(`[auth] Password reset link for ${email}: ${this.config.get("APP_URL")}/reset-password?token=${rawToken}`);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new UnauthorizedApiException("Token reset password tidak valid atau kedaluwarsa.");

    const passwordHash = await hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await this.auditLog.record({
      actorType: "USER",
      actorId: record.userId,
      action: "auth.password_reset",
      resourceType: "user",
      resourceId: record.userId,
    });
  }

  async me(userId: string) {
    const context = await loadUserAuthContext(this.prisma, userId);
    if (!context) throw new UnauthorizedApiException();
    return context;
  }

  async getAccountSettings(userId: string) {
    const context = await loadUserAuthContext(this.prisma, userId);
    if (!context) throw new UnauthorizedApiException();
    return context.accountSettings;
  }

  async updateAccountSettings(userId: string, dto: UpdateAccountSettingsDto) {
    const context = await loadUserAuthContext(this.prisma, userId);
    if (!context) throw new UnauthorizedApiException();

    const settings = normalizeUserAccountSettings({
      ...context.accountSettings,
      ...dto,
    });

    await upsertUserAccountSettings(this.prisma, userId, settings);
    await this.auditLog.record({
      organizationId: context.organizationId,
      actorType: "USER",
      actorId: userId,
      action: "auth.account_settings.updated",
      resourceType: "user",
      resourceId: userId,
      beforeData: context.accountSettings,
      afterData: settings,
    });

    return settings;
  }

  async uploadNotificationSound(userId: string, dto: UploadNotificationSoundDto, file: Express.Multer.File) {
    const context = await loadUserAuthContext(this.prisma, userId);
    if (!context) throw new UnauthorizedApiException();
    if (!file) throw new BadRequestException("File audio tidak ditemukan pada request.");

    const nextSettings = normalizeUserAccountSettings({
      ...context.accountSettings,
      ...(dto.category === "onConversation"
        ? {
            onConversationSound: CUSTOM_ON_CONVERSATION_SOUND_ID,
            customOnConversationSound: {
              id: CUSTOM_ON_CONVERSATION_SOUND_ID,
              name: file.originalname,
              storageKey: this.storage.buildStorageKey(`notification-sounds/${context.organizationId}/${userId}/${dto.category}`, file.originalname),
            },
          }
        : {
            newMessagesSound: CUSTOM_NEW_MESSAGES_SOUND_ID,
            customNewMessagesSound: {
              id: CUSTOM_NEW_MESSAGES_SOUND_ID,
              name: file.originalname,
              storageKey: this.storage.buildStorageKey(`notification-sounds/${context.organizationId}/${userId}/${dto.category}`, file.originalname),
            },
          }),
    });

    const previousStorageKey =
      dto.category === "onConversation"
        ? context.accountSettings.customOnConversationSound?.storageKey
        : context.accountSettings.customNewMessagesSound?.storageKey;
    const nextStorageKey =
      dto.category === "onConversation"
        ? nextSettings.customOnConversationSound?.storageKey
        : nextSettings.customNewMessagesSound?.storageKey;
    if (!nextStorageKey) {
      throw new BadRequestException("Gagal menyiapkan file audio kustom.");
    }

    await this.storage.upload(nextStorageKey, file.buffer, file.mimetype);
    try {
      await upsertUserAccountSettings(this.prisma, userId, nextSettings);
    } catch (error) {
      if (nextStorageKey !== previousStorageKey) {
        await this.storage.remove(nextStorageKey).catch(() => undefined);
      }
      throw error;
    }

    if (previousStorageKey && previousStorageKey !== nextStorageKey) {
      await this.storage.remove(previousStorageKey).catch(() => undefined);
    }

    await this.auditLog.record({
      organizationId: context.organizationId,
      actorType: "USER",
      actorId: userId,
      action: "auth.account_settings.notification_sound_uploaded",
      resourceType: "user",
      resourceId: userId,
      beforeData: context.accountSettings,
      afterData: nextSettings,
    });

    return nextSettings;
  }

  async getNotificationSoundDownloadUrl(userId: string, category: UploadNotificationSoundDto["category"]) {
    const context = await loadUserAuthContext(this.prisma, userId);
    if (!context) throw new UnauthorizedApiException();

    const storageKey =
      category === "onConversation"
        ? context.accountSettings.customOnConversationSound?.storageKey
        : context.accountSettings.customNewMessagesSound?.storageKey;
    if (!storageKey) {
      throw new NotFoundException("Audio notifikasi kustom belum tersedia.");
    }

    return this.storage.getSignedDownloadUrl(storageKey);
  }

  private async issueTokens(userId: string, meta: RequestMeta, tokenFamily?: string): Promise<AuthTokens> {
    const context = await loadUserAuthContext(this.prisma, userId);
    if (!context) throw new UnauthorizedApiException();

    const family = tokenFamily ?? nanoid(16);
    const expiresAt = new Date(Date.now() + parseDurationMs(this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d"));

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenFamily: family,
        refreshHash: "pending",
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    const accessPayload: JwtAccessPayload = {
      sub: userId,
      organizationId: context.organizationId,
      email: context.email,
      roles: context.roles,
      permissions: context.permissions,
      sessionId: session.id,
      type: "access",
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sessionId: session.id,
      tokenFamily: family,
      type: "refresh",
    };

    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d",
    });

    await this.prisma.session.update({ where: { id: session.id }, data: { refreshHash: hashToken(refreshToken) } });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
  return value * unitMs;
}
