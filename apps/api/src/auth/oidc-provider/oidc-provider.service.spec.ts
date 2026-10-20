import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { OidcProviderService } from "./oidc-provider.service";

describe("OidcProviderService", () => {
  const clientSecret = "oidc-secret-" + "x".repeat(32);
  const config = {
    issuer: "https://api-chat.example/api/v1",
    clientId: "clara-crm",
    clientSecret,
    redirectUri: "https://crm.example/api/auth/live-chat/callback",
    codeTtlSeconds: 120,
    tokenTtlSeconds: 300,
    allowedRoles: new Set(["cs_agent"]),
  };
  const verifier = "v".repeat(64);
  const record = {
    userId: "user-1",
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    nonce: "nonce-1",
    scope: "openid profile email",
  };

  function createService() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "agent@example.com",
          name: "Agent",
          organizationId: "org-1",
          claraUserId: "8a1d0f7c-1d45-4c0a-9058-2d2b58544e70",
          isActive: true,
          roles: [{ role: { slug: "cs_agent" } }],
        }),
      },
      session: { findUnique: jest.fn() },
    };
    const redis = {
      getdel: jest.fn().mockResolvedValue(JSON.stringify(record)),
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn(),
    };
    const appConfig = {
      get: jest.fn((key: string) =>
        key === "JWT_ACCESS_SECRET"
          ? "dashboard-secret"
          : "http://localhost:3000",
      ),
    };
    const providerConfig = { resolve: jest.fn().mockReturnValue(config) };
    const service = new OidcProviderService(
      prisma as never,
      { verifyAsync: jest.fn() } as never,
      appConfig as never,
      providerConfig as never,
      redis as never,
    );
    return { service, prisma, redis };
  }

  it("exchanges a one-time PKCE code for an HS256 ID token with required claims", async () => {
    const { service, redis } = createService();
    const basic = `Basic ${Buffer.from(`${config.clientId}:${clientSecret}`).toString("base64")}`;
    const result = await service.exchangeCode(basic, {
      grant_type: "authorization_code",
      code: "one-time-code",
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    });
    const claims = jwt.verify(result.id_token, clientSecret, {
      algorithms: ["HS256"],
      issuer: config.issuer,
      audience: config.clientId,
    });
    expect(claims).toMatchObject({
      sub: "user-1",
      nonce: "nonce-1",
      isActive: true,
      role: "cs_agent",
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(redis.getdel).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid profile email",
    });
  });

  it("consumes and rejects a code when the PKCE verifier is wrong", async () => {
    const { service, redis } = createService();
    const basic = `Basic ${Buffer.from(`${config.clientId}:${clientSecret}`).toString("base64")}`;
    await expect(
      service.exchangeCode(basic, {
        grant_type: "authorization_code",
        code: "one-time-code",
        redirect_uri: config.redirectUri,
        code_verifier: "wrong-verifier",
      }),
    ).rejects.toThrow("invalid_grant");
    expect(redis.getdel).toHaveBeenCalledTimes(1);
  });
});
