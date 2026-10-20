import { ExtensionService } from "./extension.service";

describe("ExtensionService", () => {
  it("derives the assignee from the verified extension identity and keeps snapshots idempotent", async () => {
    const tx = {
      customer: {
        upsert: jest.fn().mockResolvedValue({ id: "customer-1" }),
      },
      conversation: {
        upsert: jest.fn().mockImplementation(async ({ create }) => create),
      },
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "lead-1" }),
        update: jest.fn(),
      },
      message: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      site: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "site-db-1", organizationId: "org-1" }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(tx)),
    };
    const webhooks = {
      scheduleConversation: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ExtensionService(prisma as never, webhooks as never);
    const identity = {
      sub: "agent-from-token",
      organizationId: "org-1",
      claraUserId: "clara-1",
      audience: "solidchat-extension" as const,
    };
    const snapshot = {
      siteId: "solid-gold-main",
      conversationId: "wa-chat-123",
      customerName: "Budi",
      lead: { phone: "+628123", consentGiven: true },
      messages: [
        {
          id: "wa-msg-1",
          senderType: "sales" as const,
          text: "Halo",
          sentAt: "2026-10-20T01:00:00Z",
        },
      ],
    };

    const first = await service.upsertSnapshot("whatsapp", snapshot, identity);
    const second = await service.upsertSnapshot("whatsapp", snapshot, identity);

    expect(first.conversationId).toBe(second.conversationId);
    expect(tx.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          assignedAgentId: "agent-from-token",
          channel: "WHATSAPP",
        }),
        create: expect.objectContaining({
          assignedAgentId: "agent-from-token",
          channel: "WHATSAPP",
        }),
      }),
    );
    expect(tx.message.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(webhooks.scheduleConversation).toHaveBeenCalledWith(
      first.conversationId,
    );
  });
});
