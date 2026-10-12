import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { UnauthorizedApiException } from "../common/errors/api.exception";

@Injectable()
export class PublicKnowledgeApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = (
      this.config.get<string>("PUBLIC_KNOWLEDGE_API_KEY") ||
      this.config.get<string>("WHATSAPP_ASSISTANT_API_KEY")
    )?.trim();
    if (!configured) {
      throw new UnauthorizedApiException("Public Knowledge API key belum dikonfigurasi di server.");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers["x-knowledge-api-key"];
    const presented = typeof header === "string" ? header.trim() : "";
    if (!presented || !this.matches(configured, presented)) {
      throw new UnauthorizedApiException("Public Knowledge API key tidak valid.");
    }
    return true;
  }

  private matches(expected: string, presented: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const presentedBuffer = Buffer.from(presented);
    if (expectedBuffer.length !== presentedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, presentedBuffer);
  }
}
