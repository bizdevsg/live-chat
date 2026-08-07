import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { VISITOR_TOKEN_TTL_SECONDS, type VisitorTokenPayload } from "@solidchat/shared";
import { UnauthorizedApiException } from "../common/errors/api.exception";

@Injectable()
export class VisitorTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    return this.config.get<string>("VISITOR_TOKEN_SECRET") || this.config.get<string>("JWT_ACCESS_SECRET")!;
  }

  async sign(visitorId: string, siteId: string): Promise<string> {
    const payload: VisitorTokenPayload = { visitorId, siteId, type: "visitor" };
    return this.jwt.signAsync(payload, { secret: this.secret(), expiresIn: VISITOR_TOKEN_TTL_SECONDS });
  }

  async verify(token: string): Promise<VisitorTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<VisitorTokenPayload>(token, { secret: this.secret() });
      if (payload.type !== "visitor") throw new Error("wrong token type");
      return payload;
    } catch {
      throw new UnauthorizedApiException("Token widget tidak valid atau kedaluwarsa.");
    }
  }
}
