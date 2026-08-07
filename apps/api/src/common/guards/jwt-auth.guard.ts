import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { JwtAccessPayload } from "@solidchat/shared";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { UnauthorizedApiException } from "../errors/api.exception";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true; // WS gateways authenticate manually via handshake

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedApiException("Token akses tidak ditemukan.");

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedApiException("Token akses tidak valid atau kedaluwarsa.");
    }
    if (payload.type !== "access") throw new UnauthorizedApiException("Tipe token tidak valid.");

    const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt) {
      throw new UnauthorizedApiException("Sesi telah dicabut. Silakan login kembali.");
    }

    (request as Request & { user: JwtAccessPayload }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice(7);
    const cookieToken = (request as Request & { cookies?: Record<string, string> }).cookies?.access_token;
    return cookieToken;
  }
}
