import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { UnauthorizedApiException } from "../common/errors/api.exception";

@Injectable()
export class WhatsAppAssistantApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configured = (
      this.config.get<string>("WHATSAPP_ASSISTANT_API_KEY") ??
      this.config.get<string>("CRM_API_KEY")
    )?.trim();
    if (!configured) {
      throw new UnauthorizedApiException("Extension key belum dikonfigurasi di server.");
    }

    const presented = this.extractKey(request);
    if (!presented || !this.matches(configured, presented)) {
      throw new UnauthorizedApiException("Extension key tidak valid.");
    }
    return true;
  }

  private extractKey(request: Request): string | undefined {
    const header = request.headers["x-whatsapp-assistant-key"];
    if (typeof header === "string" && header.trim()) return header.trim();
    return undefined;
  }

  private matches(expected: string, presented: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const presentedBuffer = Buffer.from(presented);
    if (expectedBuffer.length !== presentedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, presentedBuffer);
  }
}
