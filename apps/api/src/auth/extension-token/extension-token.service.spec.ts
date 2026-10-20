import { ExtensionTokenService } from "./extension-token.service";

describe("ExtensionTokenService", () => {
  const secret = "extension-secret-" + "x".repeat(32);

  function createService() {
    let version = 0;
    const config = {
      get: jest.fn(
        (key: string) =>
          ({
            EXTENSION_TOKEN_SECRET: secret,
            EXTENSION_TOKEN_TTL_SECONDS: 900,
            JWT_ACCESS_SECRET: "access",
            JWT_REFRESH_SECRET: "refresh",
          })[key],
      ),
    };
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: "agent-1",
            organizationId: "org-1",
            claraUserId: "clara-1",
            isActive: true,
          }),
      },
    };
    const redis = {
      get: jest.fn().mockImplementation(async () => String(version)),
      incr: jest.fn().mockImplementation(async () => ++version),
    };
    return {
      service: new ExtensionTokenService(
        config as never,
        prisma as never,
        redis as never,
      ),
      prisma,
      redis,
    };
  }

  it("issues an agent-bound token with the extension audience", async () => {
    const { service } = createService();
    const issued = await service.issue("agent-1");
    await expect(service.verify(issued.accessToken)).resolves.toEqual({
      sub: "agent-1",
      organizationId: "org-1",
      claraUserId: "clara-1",
      audience: "solidchat-extension",
    });
  });

  it("revokes all existing tokens for one agent", async () => {
    const { service } = createService();
    const issued = await service.issue("agent-1");
    await service.revoke("agent-1");
    await expect(service.verify(issued.accessToken)).rejects.toThrow("dicabut");
  });

  it("stops accepting a token when the agent is disabled", async () => {
    const { service, prisma } = createService();
    const issued = await service.issue("agent-1");
    prisma.user.findUnique.mockResolvedValue({
      id: "agent-1",
      organizationId: "org-1",
      claraUserId: "clara-1",
      isActive: false,
    });
    await expect(service.verify(issued.accessToken)).rejects.toThrow("dicabut");
  });
});
