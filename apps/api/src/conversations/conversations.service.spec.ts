import { ConversationStatus, HandlerType, MessageType, SenderType } from "@solidchat/shared";
import { ConversationsService } from "./conversations.service";

describe("ConversationsService.autoReturnToAiOnAgentTimeout", () => {
  function createService(overrides?: {
    conversation?: Partial<{
      id: string;
      organizationId: string;
      siteId: string;
      assignedAgentId: string | null;
      assignedTeamId: string | null;
      status: string;
      handlerType: string;
    }> | null;
    agentReply?: { id: string } | null;
    flipCount?: number;
  }) {
    const conversation =
      overrides?.conversation === null
        ? null
        : {
            id: "conv-1",
            organizationId: "org-1",
            siteId: "site-1",
            assignedAgentId: "agent-1",
            assignedTeamId: "team-1",
            status: ConversationStatus.AGENT_ACTIVE,
            handlerType: HandlerType.HUMAN,
            ...overrides?.conversation,
          };

    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue(conversation),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: overrides?.flipCount ?? 1 }),
      },
      siteSettings: {
        findUnique: jest.fn().mockResolvedValue({ agentReplyTimeoutSeconds: 60 }),
      },
      message: {
        findFirst: jest.fn().mockResolvedValue(overrides?.agentReply ?? null),
      },
      agentProfile: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const realtime = {
      toConversation: jest.fn(),
      toTeam: jest.fn(),
      toAgent: jest.fn(),
      toSite: jest.fn(),
    };

    const queue = {
      getJob: jest.fn().mockResolvedValue({
        remove: jest.fn().mockResolvedValue(undefined),
      }),
      add: jest.fn(),
    };

    const service = new ConversationsService(
      prisma as never,
      realtime as never,
      { record: jest.fn() } as never,
      { record: jest.fn() } as never,
      {
        notifyAgent: jest.fn(),
        notifyTeam: jest.fn(),
        notifyOrganization: jest.fn(),
      } as never,
      queue as never,
    );

    jest.spyOn(service, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service, "postMessage").mockResolvedValue({
      message: {
        id: "msg-system-1",
        conversationId: "conv-1",
        senderType: SenderType.SYSTEM,
        senderId: null,
        replyToMessageId: null,
        content: "activity",
        messageType: MessageType.SYSTEM,
        isInternal: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        contentSanitized: "activity",
        clientMessageId: null,
        aiRunId: null,
        metadata: null,
        senderName: null,
      },
      sensitiveDataDetected: false,
      promptInjectionDetected: false,
    });

    return { service, prisma, realtime };
  }

  it("returns conversation to AI and posts a system activity when agent stays silent", async () => {
    const { service, prisma, realtime } = createService();

    const restored = await service.autoReturnToAiOnAgentTimeout("conv-1", new Date("2026-09-01T10:00:00.000Z"));

    expect(restored).toBe(true);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "conv-1",
        handlerType: { not: HandlerType.AI },
        status: { in: [ConversationStatus.QUEUED, ConversationStatus.WAITING_AGENT, ConversationStatus.AGENT_ACTIVE] },
      },
      data: { assignedAgentId: null, handlerType: HandlerType.AI, status: ConversationStatus.AI_ACTIVE },
    });
    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { userId: "agent-1" },
      data: { activeChatCount: { decrement: 1 } },
    });
    expect(service.logEvent).toHaveBeenCalledWith("conv-1", "conversation.auto_returned_to_ai", "SYSTEM", null, { timeoutMs: 60_000 });
    expect(service.postMessage).toHaveBeenCalledWith({
      conversationId: "conv-1",
      senderType: SenderType.SYSTEM,
      content: "Agent sedang sibuk, AI kembali membantu percakapan ini.",
      messageType: MessageType.SYSTEM,
    });
    expect(realtime.toConversation).toHaveBeenCalledWith("conv-1", "conversation:updated", {
      conversationId: "conv-1",
      assignedAgentId: null,
      handlerType: HandlerType.AI,
      status: ConversationStatus.AI_ACTIVE,
    });
  });

  it("does nothing when an agent reply already exists after the timeout started", async () => {
    const { service, prisma } = createService({ agentReply: { id: "msg-agent-1" } });

    const restored = await service.autoReturnToAiOnAgentTimeout("conv-1", new Date("2026-09-01T10:00:00.000Z"));

    expect(restored).toBe(false);
    expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
    expect(service.postMessage).not.toHaveBeenCalled();
  });

  it("does not post the notice twice when another caller already flipped the conversation", async () => {
    const { service, prisma } = createService({ flipCount: 0 });

    const restored = await service.autoReturnToAiOnAgentTimeout("conv-1", new Date("2026-09-01T10:00:00.000Z"));

    expect(restored).toBe(false);
    expect(prisma.conversation.updateMany).toHaveBeenCalled();
    expect(service.postMessage).not.toHaveBeenCalled();
    expect(service.logEvent).not.toHaveBeenCalled();
  });

  it("rejects resolve when the conversation has not been taken over by the agent", async () => {
    const { service, prisma } = createService({
      conversation: {
        assignedAgentId: null,
        status: ConversationStatus.AI_ACTIVE,
        handlerType: HandlerType.AI,
      },
    });

    await expect(service.resolve("conv-1", "agent-1")).rejects.toThrow(
      "Chat harus di-takeover agent terlebih dahulu sebelum bisa diselesaikan.",
    );
    expect(prisma.conversation.update).not.toHaveBeenCalled();
    expect(service.logEvent).not.toHaveBeenCalledWith("conv-1", "conversation.resolved", "USER", "agent-1", {});
  });

  it("allows resolve after the assigned agent has taken over the conversation", async () => {
    const { service, prisma, realtime } = createService();

    await service.resolve("conv-1", "agent-1");

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { status: ConversationStatus.RESOLVED, resolvedAt: expect.any(Date) },
    });
    expect(service.logEvent).toHaveBeenCalledWith("conv-1", "conversation.resolved", "USER", "agent-1", {});
    expect(realtime.toConversation).toHaveBeenCalledWith("conv-1", "conversation:updated", {
      conversationId: "conv-1",
      status: ConversationStatus.RESOLVED,
    });
  });
});

describe("ConversationsService.requestAgent (agents handle up to 5 concurrent chats)", () => {
  function createService(opts?: {
    onlineAgents?: Array<{ userId: string; activeChatCount: number; maxConcurrentChats: number }>;
    reserveCount?: number;
    claimCount?: number;
  }) {
    const conversation = {
      id: "conv-1",
      organizationId: "org-1",
      siteId: "site-1",
      intent: null,
      assignedAgentId: null as string | null,
      assignedTeamId: "team-1" as string | null,
      status: ConversationStatus.AI_ACTIVE,
      handlerType: HandlerType.AI,
    };

    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue(conversation),
        update: jest.fn().mockResolvedValue(conversation),
        updateMany: jest.fn().mockResolvedValue({ count: opts?.claimCount ?? 1 }),
        count: jest.fn().mockResolvedValue(5),
      },
      handoffRule: { findFirst: jest.fn().mockResolvedValue(null) },
      routingRule: { findMany: jest.fn().mockResolvedValue([]) },
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: "team-1", isActive: true }),
        findUnique: jest.fn().mockResolvedValue({ id: "team-1" }),
      },
      site: { findUnique: jest.fn().mockResolvedValue({ organizationId: "org-1" }) },
      teamMember: {
        findMany: jest.fn().mockResolvedValue(
          (opts?.onlineAgents ?? []).map((a) => ({
            userId: a.userId,
            user: { agentProfile: { availability: "ONLINE", activeChatCount: a.activeChatCount, maxConcurrentChats: a.maxConcurrentChats } },
          })),
        ),
      },
      agentProfile: {
        updateMany: jest.fn().mockResolvedValue({ count: opts?.reserveCount ?? 1 }),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ maxConcurrentChats: 5 }),
      },
      conversationAssignment: { create: jest.fn().mockResolvedValue({}) },
      conversationParticipant: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: "Agent Satu" }) },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const realtime = { toConversation: jest.fn(), toTeam: jest.fn(), toAgent: jest.fn(), toSite: jest.fn() };
    const queue = { getJob: jest.fn().mockResolvedValue({ remove: jest.fn().mockResolvedValue(undefined) }), add: jest.fn() };
    const notifications = { notifyAgent: jest.fn(), notifyTeam: jest.fn(), notifyOrganization: jest.fn() };

    const service = new ConversationsService(
      prisma as never,
      realtime as never,
      { record: jest.fn() } as never,
      { record: jest.fn() } as never,
      notifications as never,
      queue as never,
    );
    jest.spyOn(service, "logEvent").mockResolvedValue(undefined);
    jest.spyOn(service, "postMessage").mockResolvedValue({
      message: { id: "m1" },
      sensitiveDataDetected: false,
      promptInjectionDetected: false,
    } as never);

    return { service, prisma, realtime, notifications };
  }

  it("assigns to a free ONLINE agent and atomically claims the slot", async () => {
    const { service, prisma } = createService({
      onlineAgents: [{ userId: "agent-1", activeChatCount: 0, maxConcurrentChats: 5 }],
      reserveCount: 1,
    });

    await service.requestAgent("conv-1", "CUSTOMER_REQUESTED_HUMAN");

    expect(prisma.agentProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: "agent-1", activeChatCount: { lt: 5 } },
      data: { activeChatCount: { increment: 1 } },
    });
    expect(service.logEvent).toHaveBeenCalledWith("conv-1", "handoff.requested", "SYSTEM", null, {
      reason: "CUSTOMER_REQUESTED_HUMAN",
      teamId: "team-1",
      outcome: "assigned",
    });
  });

  it("queues the visitor for first-come-first-served pickup when every agent is at capacity", async () => {
    const { service, prisma, notifications } = createService({
      onlineAgents: [{ userId: "agent-1", activeChatCount: 5, maxConcurrentChats: 5 }],
    });

    await service.requestAgent("conv-1", "CUSTOMER_REQUESTED_HUMAN");

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { status: ConversationStatus.QUEUED, handlerType: HandlerType.NONE, assignedAgentId: null },
    });
    expect(service.logEvent).toHaveBeenCalledWith("conv-1", "handoff.requested", "SYSTEM", null, {
      reason: "CUSTOMER_REQUESTED_HUMAN",
      teamId: "team-1",
      outcome: "queued",
    });
    expect(notifications.notifyTeam).toHaveBeenCalledWith(
      "team-1",
      "NEW_WAITING_CONVERSATION",
      expect.any(String),
      expect.any(String),
      { conversationId: "conv-1" },
    );
  });

  it("rejects a manual accept when the agent is already at capacity", async () => {
    const { service } = createService({ reserveCount: 0 });

    await expect(service.accept("conv-1", "agent-1")).rejects.toThrow("jumlah chat maksimum");
  });

  it("repairs a stale workload counter before rejecting a manual accept", async () => {
    const { service, prisma } = createService();
    prisma.conversation.count.mockResolvedValue(0);
    let reservationAttempts = 0;
    prisma.agentProfile.updateMany.mockImplementation((input: { data: { activeChatCount: number | { increment: number } } }) => {
      if (input.data.activeChatCount === 0) return Promise.resolve({ count: 1 });
      return Promise.resolve({ count: reservationAttempts++ === 0 ? 0 : 1 });
    });

    await expect(service.accept("conv-1", "agent-1")).resolves.toBeDefined();

    expect(prisma.agentProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: "agent-1", activeChatCount: { gte: 5 } },
      data: { activeChatCount: 0 },
    });
  });

  it("claims the conversation atomically on a single accept", async () => {
    const { service, prisma } = createService();

    await service.accept("conv-1", "agent-9");

    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: "conv-1", assignedAgentId: null },
      data: expect.objectContaining({ assignedAgentId: "agent-9", status: ConversationStatus.AGENT_ACTIVE }),
    });
    expect(prisma.conversationAssignment.create).toHaveBeenCalled();
  });

  it("tells the losing agent the chat is already taken when two accepts race", async () => {
    // The other agent's conditional UPDATE already flipped assignedAgentId, so this one matches 0 rows.
    const { service, prisma } = createService({ claimCount: 0 });

    await expect(service.accept("conv-1", "agent-2")).rejects.toThrow("Percakapan sudah diambil oleh agent lain");
    // Slot reserved for the losing attempt is handed back.
    expect(prisma.agentProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: "agent-2", activeChatCount: { gt: 0 } },
      data: { activeChatCount: { decrement: 1 } },
    });
  });
});
