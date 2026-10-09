import { WidgetService } from "./widget.service";

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
