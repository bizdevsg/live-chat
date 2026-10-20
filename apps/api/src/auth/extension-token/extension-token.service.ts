import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import type Redis from "ioredis";
import jwt from "jsonwebtoken";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS_CLIENT } from "../../redis/redis.module";

const EXTENSION_AUDIENCE = "solidchat-extension";
const EXTENSION_ISSUER = "solidchat-api";

export interface ExtensionIdentity {
  sub: string;
  organizationId: string;
  claraUserId?: string;
  audience: typeof EXTENSION_AUDIENCE;
}

interface ExtensionTokenClaims {
  sub: string;
  organizationId: string;
  claraUserId?: string;
  ver: number;
  type: "extension";
}

@Injectable()
export class ExtensionTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async issue(userId: string) {
    const secret = this.resolveSecret();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        claraUserId: true,
        isActive: true,
      },
    });
    if (!user?.isActive) throw new UnauthorizedException("Agent tidak aktif.");
    const ttl = this.config.get<number>("EXTENSION_TOKEN_TTL_SECONDS") ?? 900;
    const version = await this.currentVersion(user.id);
    const token = jwt.sign(
      {
        sub: user.id,
        organizationId: user.organizationId,
        ...(user.claraUserId ? { claraUserId: user.claraUserId } : {}),
        ver: version,
        type: "extension",
      } satisfies ExtensionTokenClaims,
      secret,
      {
        algorithm: "HS256",
        issuer: EXTENSION_ISSUER,
        audience: EXTENSION_AUDIENCE,
        expiresIn: ttl,
        jwtid: randomBytes(16).toString("base64url"),
      },
    );
    return {
      accessToken: token,
      tokenType: "Bearer",
      expiresIn: ttl,
      audience: EXTENSION_AUDIENCE,
    };
  }

  async verify(token: string): Promise<ExtensionIdentity> {
    let claims: ExtensionTokenClaims;
    try {
      claims = jwt.verify(token, this.resolveSecret(), {
        algorithms: ["HS256"],
        issuer: EXTENSION_ISSUER,
        audience: EXTENSION_AUDIENCE,
      }) as ExtensionTokenClaims;
    } catch {
      throw new UnauthorizedException(
        "Token extension tidak valid atau kedaluwarsa.",
      );
    }
    if (claims.type !== "extension" || !claims.sub || !claims.organizationId) {
      throw new UnauthorizedException("Tipe token extension tidak valid.");
    }
    const [version, user] = await Promise.all([
      this.currentVersion(claims.sub),
      this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { organizationId: true, claraUserId: true, isActive: true },
      }),
    ]);
    if (
      !user?.isActive ||
      user.organizationId !== claims.organizationId ||
      version !== claims.ver
    ) {
      throw new UnauthorizedException(
        "Token extension telah dicabut atau agent tidak aktif.",
      );
    }
    return {
      sub: claims.sub,
      organizationId: user.organizationId,
      ...(user.claraUserId ? { claraUserId: user.claraUserId } : {}),
      audience: EXTENSION_AUDIENCE,
    };
  }

  async revoke(userId: string): Promise<void> {
    await this.redis.incr(this.versionKey(userId));
  }

  private async currentVersion(userId: string): Promise<number> {
    return Number((await this.redis.get(this.versionKey(userId))) ?? "0");
  }

  private versionKey(userId: string) {
    return `extension:token-version:${userId}`;
  }

  private resolveSecret(): string {
    const secret = this.config.get<string>("EXTENSION_TOKEN_SECRET")?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        "Token extension belum dikonfigurasi.",
      );
    if (secret.length < 32)
      throw new Error("EXTENSION_TOKEN_SECRET minimal 32 karakter.");
    if (
      secret === this.config.get("JWT_ACCESS_SECRET") ||
      secret === this.config.get("JWT_REFRESH_SECRET")
    ) {
      throw new Error(
        "EXTENSION_TOKEN_SECRET harus berbeda dari secret dashboard.",
      );
    }
    return secret;
  }
}
