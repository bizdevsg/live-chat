import { OverviewController } from "./overview.controller";

describe("OverviewController online agents", () => {
  it("returns only active online agents from the current organization", async () => {
    const prisma = {
      conversation: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([{ assignedAgentId: "agent-1", _count: { _all: 2 } }]),
      },
      ticket: { count: jest.fn().mockResolvedValue(0) },
      agentProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: "agent-1",
            availability: "ONLINE",
            maxConcurrentChats: 5,
            user: { name: "Agent Satu", email: "agent@example.com" },
          },
        ]),
      },
      customerFeedback: { aggregate: jest.fn().mockResolvedValue({ _avg: { score: null } }) },
    };
    const realtime = { connectedDashboardUserIds: jest.fn().mockResolvedValue(["agent-1"]) };
    const controller = new OverviewController(prisma as never, {} as never, {} as never, realtime as never);

    const response = await controller.overview({ organizationId: "org-1" } as never);

    expect(prisma.agentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: { in: ["agent-1"] },
          availability: { in: ["ONLINE", "BUSY"] },
          user: { organizationId: "org-1", isActive: true },
        },
      }),
    );
    expect(response.data.agentsOnline).toBe(1);
    expect(response.data.onlineAgents).toEqual([
      {
        userId: "agent-1",
        name: "Agent Satu",
        email: "agent@example.com",
        availability: "ONLINE",
        activeChatCount: 2,
        maxConcurrentChats: 5,
      },
    ]);
  });

  it("excludes stale ONLINE profiles without an active dashboard socket", async () => {
    const prisma = {
      conversation: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      ticket: { count: jest.fn().mockResolvedValue(0) },
      agentProfile: { findMany: jest.fn().mockResolvedValue([]) },
      customerFeedback: { aggregate: jest.fn().mockResolvedValue({ _avg: { score: null } }) },
    };
    const realtime = { connectedDashboardUserIds: jest.fn().mockResolvedValue([]) };
    const controller = new OverviewController(prisma as never, {} as never, {} as never, realtime as never);

    const response = await controller.overview({ organizationId: "org-1" } as never);

    expect(response.data.agentsOnline).toBe(0);
    expect(response.data.onlineAgents).toEqual([]);
  });
});
