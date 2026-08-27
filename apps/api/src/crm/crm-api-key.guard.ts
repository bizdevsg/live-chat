import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { UnauthorizedApiException } from "../common/errors/api.exception";

@Injectable()
export class CrmApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const presented = this.extractApiKey(request.headers);
    const expected = this.config.get<string>("CRM_INBOUND_API_KEY") ?? this.config.get<string>("CRM_API_KEY");

    if (!expected) {
      throw new UnauthorizedApiException("CRM inbound API key belum dikonfigurasi.");
    }
    if (!presented || !this.matches(expected, presented)) {
      throw new UnauthorizedApiException("CRM API key tidak valid.");
    }

    return true;
  }

  private extractApiKey(headers: Record<string, string | string[] | undefined>): string | undefined {
    const xApiKey = headers["x-api-key"];
    if (typeof xApiKey === "string" && xApiKey.trim()) return xApiKey.trim();

    const authorization = headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      const token = authorization.slice(7).trim();
      if (token) return token;
    }

    return undefined;
  }

  private matches(expected: string, presented: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const presentedBuffer = Buffer.from(presented);
    if (expectedBuffer.length !== presentedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, presentedBuffer);
  }
}

