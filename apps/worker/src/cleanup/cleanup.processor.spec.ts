import { ConversationStatus, HandlerType } from "@solidchat/shared";
import { CleanupProcessor } from "./cleanup.processor";

describe("CleanupProcessor.autoCloseInactiveConversations", () => {
  function buildProcessor() {
    const conversationFindMany = jest.fn();
    const conversationUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const conversationEventCreateMany = jest.fn().mockResolvedValue({ count: 0 });
    const agentProfileUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

    const tx = {
      conversation: {
        findMany: conversationFindMany,
        updateMany: conversationUpdateMany,
      },
      conversationEvent: {
        createMany: conversationEventCreateMany,
      },
      agentProfile: {
        updateMany: agentProfileUpdateMany,
      },
    };

    const prisma = {
      conversation: {
        findMany: conversationFindMany,
      },
      $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    return {
      processor: new CleanupProcessor(prisma as never),
      prisma,
      conversationFindMany,
      conversationUpdateMany,
      conversationEventCreateMany,
      agentProfileUpdateMany,
    };
  }

  it("closes conversations inactive for 1 hour and releases active human agents", async () => {
    const { processor, prisma, conversationFindMany, conversationUpdateMany, conversationEventCreateMany, agentProfileUpdateMany } =
      buildProcessor();
    const now = new Date("2026-09-02T12:00:00.000Z");

    conversationFindMany
      .mockResolvedValueOnce([{ id: "conv-ai" }, { id: "conv-agent" }])
      .mockResolvedValueOnce([
        { id: "conv-ai", assignedAgentId: null, status: ConversationStatus.AI_ACTIVE, handlerType: HandlerType.AI },
        { id: "conv-agent", assignedAgentId: "agent-1", status: ConversationStatus.AGENT_ACTIVE, handlerType: HandlerType.HUMAN },
      ]);

    const closedCount = await (processor as unknown as { autoCloseInactiveConversations: (date: Date) => Promise<number> }).autoCloseInactiveConversations(
      now,
    );

    expect(conversationFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: {
          notIn: [ConversationStatus.RESOLVED, ConversationStatus.CLOSED, ConversationStatus.SPAM, ConversationStatus.BLOCKED],
        },
        OR: [{ lastMessageAt: { lt: new Date("2026-09-02T11:00:00.000Z") } }, { lastMessageAt: null, createdAt: { lt: new Date("2026-09-02T11:00:00.000Z") } }],
      },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(conversationUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["conv-ai", "conv-agent"] } },
      data: { status: ConversationStatus.CLOSED, closedAt: now },
    });
    expect(conversationEventCreateMany).toHaveBeenCalledWith({
      data: [
        {
          conversationId: "conv-ai",
          type: "conversation.auto_closed_inactive",
          actorType: "SYSTEM",
          actorId: null,
          payload: { inactivityHours: 1 },
        },
        {
          conversationId: "conv-agent",
          type: "conversation.auto_closed_inactive",
          actorType: "SYSTEM",
          actorId: null,
          payload: { inactivityHours: 1 },
        },
      ],
    });
    expect(agentProfileUpdateMany).toHaveBeenCalledWith({
      where: { userId: "agent-1" },
      data: { activeChatCount: { decrement: 1 } },
    });
    expect(closedCount).toBe(2);
  });

  it("skips the transaction when no stale conversations are found", async () => {
    const { processor, prisma, conversationFindMany, conversationUpdateMany, conversationEventCreateMany, agentProfileUpdateMany } = buildProcessor();

    conversationFindMany.mockResolvedValueOnce([]);

    const closedCount = await (processor as unknown as { autoCloseInactiveConversations: (date: Date) => Promise<number> }).autoCloseInactiveConversations(
      new Date("2026-09-02T12:00:00.000Z"),
    );

    expect(closedCount).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(conversationUpdateMany).not.toHaveBeenCalled();
    expect(conversationEventCreateMany).not.toHaveBeenCalled();
    expect(agentProfileUpdateMany).not.toHaveBeenCalled();
  });
});
