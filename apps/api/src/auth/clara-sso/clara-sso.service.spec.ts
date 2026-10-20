import type { ClaraSsoConfig } from "./clara-sso.config";
import { ClaraSsoService } from "./clara-sso.service";

describe("ClaraSsoService authorization redirect", () => {
  const config: ClaraSsoConfig = {
    issuer: "https://crm.example.com/api",
    clientId: "live-chat-dashboard",
    clientSecret: "client-secret-which-is-long-enough-for-tests",
    redirectUri: "https://live-chat.example.com/api/v1/auth/clara/callback",
    allowedRoles: ["sales"],
    stateTtlSeconds: 600,
    postLoginPath: "/dashboard",
    appUrl: "https://live-chat.example.com",
    defaultOrganizationSlug: "solid-gold",
    roleMap: { sales: "cs_agent" },
  };

  function createService() {
    const state = { save: jest.fn().mockResolvedValue(undefined) };
    const service = new ClaraSsoService(
      {} as never,
      { resolve: jest.fn().mockReturnValue(config) } as never,
      state as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, state };
  }

  it("requests a fresh Clara login after an explicit Live Chat logout", async () => {
    const { service, state } = createService();

    const redirect = new URL(
      await service.buildAuthorizationRedirect("/dashboard", { promptLogin: true }),
    );

    expect(redirect.searchParams.get("prompt")).toBe("login");
    expect(redirect.searchParams.get("client_id")).toBe(config.clientId);
    expect(state.save).toHaveBeenCalledTimes(1);
  });

  it("keeps normal SSO login seamless when no logout marker is present", async () => {
    const { service } = createService();

    const redirect = new URL(await service.buildAuthorizationRedirect("/dashboard"));

    expect(redirect.searchParams.has("prompt")).toBe(false);
  });
});
