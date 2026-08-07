import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { VisitorTokenPayload } from "@solidchat/shared";
import { VisitorTokenService } from "../visitor-token.service";
import { UnauthorizedApiException } from "../../common/errors/api.exception";

export interface VisitorRequest extends Request {
  visitor: VisitorTokenPayload;
}

@Injectable()
export class VisitorAuthGuard implements CanActivate {
  constructor(private readonly visitorTokens: VisitorTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<VisitorRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedApiException("Token widget diperlukan.");
    request.visitor = await this.visitorTokens.verify(header.slice(7));
    return true;
  }
}
