import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { OidcProviderService } from "./oidc-provider.service";

@Public()
@Controller("api/v1")
export class OidcProviderController {
  constructor(private readonly oidc: OidcProviderService) {}

  @Get(".well-known/openid-configuration")
  discovery() {
    return this.oidc.discovery();
  }

  @Get("oauth/authorize")
  async authorize(
    @Req() req: Request,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(await this.oidc.authorize(req, query));
  }

  @Post("oauth/token")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  token(@Req() req: Request, @Body() body: Record<string, string | undefined>) {
    return this.oidc.exchangeCode(req.headers.authorization, body);
  }

  @Get("oauth/userinfo")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  userinfo(@Req() req: Request) {
    return this.oidc.userinfo(req.headers.authorization);
  }
}
