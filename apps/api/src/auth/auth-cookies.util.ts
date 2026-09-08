import type { CookieOptions, Request, Response } from "express";
import type { ConfigService } from "@nestjs/config";

/**
 * Shared cookie policy for anything that creates a Dashboard session — the regular
 * email/password login (AuthController) and the Clara SSO callback (ClaraSsoController)
 * must end up with byte-identical cookies, or a session created by one path could behave
 * differently from a session created by the other.
 */
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function setAuthCookies(req: Request, res: Response, config: ConfigService, accessToken: string, refreshToken: string): void {
  const common = resolveCookieOptions(req, config);
  res.cookie(ACCESS_COOKIE, accessToken, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 30 * 24 * 60 * 60 * 1000, path: "/api/v1/auth" });
}

export function clearAuthCookies(req: Request, res: Response, config: ConfigService): void {
  const common = resolveCookieOptions(req, config);
  res.clearCookie(ACCESS_COOKIE, common);
  res.clearCookie(REFRESH_COOKIE, { ...common, path: "/api/v1/auth" });
}

export function resolveCookieOptions(req: Request, config: ConfigService): CookieOptions {
  const configuredDomain = normalizeCookieDomain(config.get<string>("COOKIE_DOMAIN"));
  const requestHost = (req.hostname || "").toLowerCase();
  const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"].split(",")[0]?.trim().toLowerCase() : undefined;
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const requestIsHttps = req.secure || forwardedProto === "https";
  const originHost = requestOrigin ? extractOriginHost(requestOrigin) : null;
  const crossOrigin = !!originHost && originHost !== requestHost;

  const options: CookieOptions = {
    httpOnly: true,
    secure: requestIsHttps || config.get("NODE_ENV") === "production",
    sameSite: "lax",
  };

  if (crossOrigin && options.secure) {
    options.sameSite = "none";
  }

  if (configuredDomain && configuredDomain !== "localhost" && hostMatchesDomain(requestHost, configuredDomain)) {
    options.domain = configuredDomain;
  }

  return options;
}

function extractOriginHost(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeCookieDomain(domain?: string): string | null {
  const trimmed = domain?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^\./, "");
}

function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}
