import { OverviewController } from "./overview.controller";

describe("OverviewController online agents", () => {
  it("returns only active online agents from the current organization", async () => {
    const prisma = {
      conversation: { count: jest.fn().mockResolvedValue(0) },
      ticket: { count: jest.fn().mockResolvedValue(0) },
      agentProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: "agent-1",
            activeChatCount: 2,
            maxConcurrentChats: 5,
            user: { name: "Agent Satu", email: "agent@example.com" },
          },
        ]),
      },
      customerFeedback: { aggregate: jest.fn().mockResolvedValue({ _avg: { score: null } }) },
    };
    const controller = new OverviewController(prisma as never, {} as never, {} as never);

    const response = await controller.overview({ organizationId: "org-1" } as never);

    expect(prisma.agentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { availability: "ONLINE", user: { organizationId: "org-1", isActive: true } },
      }),
    );
    expect(response.data.agentsOnline).toBe(1);
    expect(response.data.onlineAgents).toEqual([
      {
        userId: "agent-1",
        name: "Agent Satu",
        email: "agent@example.com",
        activeChatCount: 2,
        maxConcurrentChats: 5,
      },
    ]);
  });
});
