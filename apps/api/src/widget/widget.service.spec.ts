import { WidgetService } from "./widget.service";
import jwt from "jsonwebtoken";

describe("WidgetService.ensureConversation", () => {
  function createService() {
    const site = {
      id: "site-1",
      organizationId: "org-1",
      language: "id",
      settings: { preChatFormEnabled: true },
    };
    const existing = { id: "conv-existing" };
    const created = { id: "conv-new" };
    const prisma = {
      site: { findUniqueOrThrow: jest.fn().mockResolvedValue(site) },
    };
    const conversations = {
      getActiveConversation: jest.fn().mockResolvedValue(existing),
      createConversation: jest.fn().mockResolvedValue(created),
    };
    const service = new WidgetService(
      prisma as never,
      conversations as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, conversations, existing, created };
  }

  it("reuses the active conversation during normal initialization", async () => {
    const { service, conversations, existing } = createService();

    await expect(service.ensureConversation("site-1", "visitor-1")).resolves.toBe(existing);
    expect(conversations.getActiveConversation).toHaveBeenCalledWith("site-1", "visitor-1");
    expect(conversations.createConversation).not.toHaveBeenCalled();
  });

  it("always creates a separate thread when forceNew is requested", async () => {
    const { service, conversations, created } = createService();

    await expect(service.ensureConversation("site-1", "visitor-1", undefined, true)).resolves.toBe(created);
    expect(conversations.getActiveConversation).not.toHaveBeenCalled();
    expect(conversations.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        siteId: "site-1",
        visitorId: "visitor-1",
        skipRouting: true,
      }),
    );
  });
});

describe("WidgetService.identify", () => {
  const secret = "customer_identity_test_secret";

  function createIdentityService() {
    const prisma = {
      site: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "site-db-1", siteKey: "site-public-1" }) },
      customerIdentity: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "identity-1" }),
      },
      customer: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: "customer-1", ...create })),
      },
    };
    const conversations = { getActiveConversation: jest.fn().mockResolvedValue(null) };
    const config = {
      get: jest.fn((key: string) => {
        if (key === "CUSTOMER_IDENTITY_JWT_SECRET") return secret;
        if (key === "CUSTOMER_IDENTITY_ISSUER") return "sg-berjangka.com";
        if (key === "CUSTOMER_IDENTITY_AUDIENCE") return "solidchat";
        return undefined;
      }),
    };
    const service = new WidgetService(
      prisma as never,
      conversations as never,
      {} as never,
      {} as never,
      {} as never,
      config as never,
    );

    return { service, prisma };
  }

  it("uses the normalized email as customer name when the JWT does not contain name", async () => {
    const { service, prisma } = createIdentityService();
    const identityToken = jwt.sign(
      {
        sub: "customer-123",
        siteId: "site-public-1",
        email: " Customer@Example.com ",
        accountStatus: "active",
      },
      secret,
      {
        issuer: "sg-berjangka.com",
        audience: "solidchat",
        jwtid: "identity-token-1",
        expiresIn: "5m",
      },
    );

    await expect(service.identify("site-db-1", "visitor-1", identityToken)).resolves.toEqual({
      customerId: "customer-1",
      name: "customer@example.com",
    });
    expect(prisma.customer.upsert).toHaveBeenCalledWith({
      where: { siteId_externalId: { siteId: "site-db-1", externalId: "customer-123" } },
      update: { name: "customer@example.com", email: "customer@example.com", accountStatus: "active" },
      create: {
        siteId: "site-db-1",
        externalId: "customer-123",
        name: "customer@example.com",
        email: "customer@example.com",
        accountStatus: "active",
      },
    });
  });

  it("rejects an identity JWT without a valid email", async () => {
    const { service, prisma } = createIdentityService();
    const identityToken = jwt.sign(
      { sub: "customer-123", siteId: "site-public-1", accountStatus: "active" },
      secret,
      {
        issuer: "sg-berjangka.com",
        audience: "solidchat",
        jwtid: "identity-token-2",
        expiresIn: "5m",
      },
    );

    await expect(service.identify("site-db-1", "visitor-1", identityToken)).rejects.toThrow(
      "Identity token wajib berisi email customer yang valid.",
    );
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
  });
});
