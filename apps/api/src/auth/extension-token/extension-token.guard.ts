import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  ExtensionTokenService,
  type ExtensionIdentity,
} from "./extension-token.service";

export type ExtensionRequest = Request & { extensionUser: ExtensionIdentity };

@Injectable()
export class ExtensionTokenGuard implements CanActivate {
  constructor(private readonly tokens: ExtensionTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtensionRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer "))
      throw new UnauthorizedException("Token extension tidak ditemukan.");
    request.extensionUser = await this.tokens.verify(authorization.slice(7));
    return true;
  }
}
