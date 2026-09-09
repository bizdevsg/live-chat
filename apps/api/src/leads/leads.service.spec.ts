import { LeadsService } from "./leads.service";

/**
 * Regression: the widget keeps the visitor + conversation id in localStorage forever, so a second
 * person filling in the pre-chat form on the same browser used to land on the previous visitor's
 * still-open conversation — and `createFromWidget` would rename that visitor's customer record to
 * the new person and splice the new lead onto their transcript.
 */
describe("LeadsService.createFromWidget — shared-browser identity checkpoint", () => {
  function createService(options: {
    inheritedConversation: Record<string, unknown> | null;
    inheritedOwner?: { email: string | null; phone: string | null } | null;
    /** Customer the pre-chat email/phone already resolves to (returning visitor), or null. */
    existingCustomerByContact?: { id: string; email: string | null; phone: string | null } | null;
    resumableConversation?: { id: string; assignedAgentId: string | null; assignedTeamId: string | null; status: string } | null;
    freshConversationId?: string;
  }) {
    const freshConversationId = options.freshConversationId ?? "conv-fresh";

    const tx = {
      customer: {
        findUnique: jest.fn().mockResolvedValue(options.inheritedOwner ?? null),
        findFirst: jest.fn().mockResolvedValue(options.existingCustomerByContact ?? null),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "cust-new", ...data })),
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(options.resumableConversation ?? null),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      lead: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "lead-1", ...data })),
      },
      leadEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    const freshConversation = {
      id: freshConversationId,
      organizationId: "org-1",
      siteId: "site-1",
      visitorId: "vis-1",
      assignedAgentId: null,
      assignedTeamId: null,
      customerId: null,
      status: "AI_ACTIVE",
      handlerType: "AI",
      firstMessageAt: null,
    };

    const prisma = {
      site: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "site-1",
          organizationId: "org-1",
          name: "Solid Gold",
          language: "id",
          settings: { preChatFormEnabled: true },
        }),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue(options.inheritedOwner ?? null),
      },
      conversation: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === options.inheritedConversation?.id) return Promise.resolve(options.inheritedConversation);
          if (where.id === freshConversationId) return Promise.resolve(freshConversation);
          return Promise.resolve({
            id: where.id,
            organizationId: "org-1",
            siteId: "site-1",
            assignedTeamId: null,
            assignedAgentId: null,
            handlerType: "AI",
            status: "AI_ACTIVE",
          });
        }),
      },
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };

    const conversations = {
      createConversation: jest.fn().mockResolvedValue({ id: freshConversationId }),
    };

    const crmSyncQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notifyTeam: jest.fn(), notifyOrganization: jest.fn() };
    const realtime = { toSite: jest.fn(), toTeam: jest.fn() };

    const service = new LeadsService(
      prisma as never,
      { record: jest.fn() } as never,
      { getAdapter: jest.fn() } as never,
      notifications as never,
      realtime as never,
      conversations as never,
      crmSyncQueue as never,
    );

    return { service, prisma, tx, conversations };
  }

  const inheritedConversation = {
    id: "conv-mega",
    organizationId: "org-1",
    siteId: "site-1",
    visitorId: "vis-1",
    assignedAgentId: null,
    assignedTeamId: null,
    customerId: "cust-mega",
    status: "AI_ACTIVE",
    handlerType: "AI",
    firstMessageAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("routes a different person onto a brand-new conversation instead of the inherited one", async () => {
    const { service, tx, conversations } = createService({
      inheritedConversation,
      inheritedOwner: { email: "mega@example.com", phone: "0899" },
    });

    const result = await service.createFromWidget("site-1", "conv-mega", {
      name: "Dito",
      email: "dito@example.com",
      phone: "0811",
      consentGiven: true,
    } as never);

    expect(conversations.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", siteId: "site-1", visitorId: "vis-1" }),
    );
    expect(result.conversationId).toBe("conv-fresh");
    // Mega's customer record is never touched.
    expect(tx.customer.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cust-mega" } }));
    expect(tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conversationId: "conv-fresh" }) }),
    );
  });

  it("keeps the same person on their existing conversation", async () => {
    const { service, tx, conversations } = createService({
      inheritedConversation,
      inheritedOwner: { email: "mega@example.com", phone: "0899" },
      existingCustomerByContact: { id: "cust-mega", email: "mega@example.com", phone: "0899" },
    });
    tx.customer.findUnique.mockResolvedValue({ id: "cust-mega", email: "mega@example.com", phone: "0899" });

    const result = await service.createFromWidget("site-1", "conv-mega", {
      name: "Mega",
      email: "mega@example.com",
      phone: "0899",
      consentGiven: true,
    } as never);

    expect(conversations.createConversation).not.toHaveBeenCalled();
    expect(result.conversationId).toBe("conv-mega");
  });

  it("rejects submissions without consent", async () => {
    const { service } = createService({ inheritedConversation: null });
    await expect(
      service.createFromWidget("site-1", undefined, {
        name: "Dito",
        email: "dito@example.com",
        phone: "0811",
        consentGiven: false,
      } as never),
    ).rejects.toThrow();
  });
});
