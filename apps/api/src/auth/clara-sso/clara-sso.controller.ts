import { Controller, Get, Logger, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { setAuthCookies } from "../auth-cookies.util";
import { ClaraSsoConfigService } from "./clara-sso.config";
import { ClaraSsoLoginError, ClaraSsoService } from "./clara-sso.service";

function isInternalPath(path: string | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

/**
 * Consumer side of Clara SSO (Kebutuhan API Live Chat dan SSO Dashboard §4A / Bagian B). Both
 * routes are unauthenticated on purpose — the agent has no Dashboard session yet when they hit
 * either one — and both are plain browser redirects, never JSON, because a real browser
 * navigation (not a fetch from the Dashboard SPA) drives this whole flow end to end.
 */
@ApiTags("auth")
@Controller("api/v1/auth/clara")
export class ClaraSsoController {
  private readonly logger = new Logger(ClaraSsoController.name);

  constructor(
    private readonly claraSso: ClaraSsoService,
    private readonly ssoConfig: ClaraSsoConfigService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get("login")
  async login(@Query("returnPath") returnPath: string | undefined, @Res() res: Response): Promise<void> {
    const cfg = this.ssoConfig.resolve();
    // returnPath only ever comes from our own "Masuk dengan Clara" link — validated anyway so a
    // tampered query string can't turn this into an open redirect (Bagian B, "returnPath harus
    // berupa path internal yang sudah di-allowlist").
    const target = isInternalPath(returnPath) ? returnPath : cfg.postLoginPath;
    const redirectUrl = await this.claraSso.buildAuthorizationRedirect(target);
    res.redirect(redirectUrl);
  }

  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    const requestId = (req as Request & { requestId?: string }).requestId ?? "unknown";

    try {
      const { tokens, returnPath } = await this.claraSso.handleCallback(code, state, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      setAuthCookies(req, res, this.config, tokens.accessToken, tokens.refreshToken);
      res.redirect(`${appUrl}${returnPath}`);
    } catch (error) {
      // Bagian B: "Log tidak boleh berisi authorization code, code_verifier, client secret,
      // access token, ID token, atau isi session cookie" — so only a safe reason code is logged,
      // and the user only ever sees a generic message plus the correlation id.
      const reason = error instanceof ClaraSsoLoginError ? error.message : "unexpected_error";
      this.logger.warn(`Clara SSO login failed [${requestId}]: ${reason}`);
      res.redirect(`${appUrl}/login?ssoError=1&requestId=${encodeURIComponent(requestId)}`);
    }
  }
}
