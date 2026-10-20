import { Controller, Delete, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@solidchat/shared";
import { ExtensionTokenService } from "./extension-token.service";

@Controller("api/v1/auth/extension-token")
export class ExtensionTokenController {
  constructor(private readonly tokens: ExtensionTokenService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async issue(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.tokens.issue(user.sub) };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async revoke(@CurrentUser() user: JwtAccessPayload) {
    await this.tokens.revoke(user.sub);
    return { success: true, data: null };
  }
}
