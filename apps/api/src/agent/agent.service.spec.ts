import { Permission } from "@solidchat/shared";
import { AgentService } from "./agent.service";

/**
 * Regression: after Agent A transfers a conversation to Agent B, A shares B's team but is no
 * longer individually assigned — A must lose the ability to act on it (reply, transfer again,
 * resolve, …), even though team-routing still needs to let *unclaimed* conversations through so
 * any teammate can accept them. A should still be able to *view* it, though — it's their history.
 */
describe("AgentService conversation access", () => {
  function createService(conversation: {
    organizationId: string;
    assignedAgentId: string | null;
    assignedTeamId: string | null;
  }) {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue({ id: "conv-1", ...conversation }) },
      teamMember: { findMany: jest.fn().mockResolvedValue([{ teamId: "team-1" }]) },
      conversationParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AgentService(
      prisma as never,
      { toOrganizationDashboard: jest.fn() } as never,
      { broadcastPresence: jest.fn() } as never,
      {} as never,
    );
    return { service, prisma };
  }

  const agentUser = { sub: "agent-a", organizationId: "org-1", permissions: [] as string[] } as never;

  it("denies a teammate acting on a conversation once it's assigned to someone else", async () => {
    const { service } = createService({ organizationId: "org-1", assignedAgentId: "agent-b", assignedTeamId: "team-1" });
    await expect(service.assertConversationAccess(agentUser, "conv-1")).rejects.toThrow();
  });

  it("still lets a teammate act on an unclaimed, team-routed conversation", async () => {
    const { service } = createService({ organizationId: "org-1", assignedAgentId: null, assignedTeamId: "team-1" });
    await expect(service.assertConversationAccess(agentUser, "conv-1")).resolves.toBeDefined();
  });

  it("lets the currently assigned agent act regardless of team", async () => {
    const { service } = createService({ organizationId: "org-1", assignedAgentId: "agent-a", assignedTeamId: "team-2" });
    await expect(service.assertConversationAccess(agentUser, "conv-1")).resolves.toBeDefined();
  });

  it("lets CONVERSATION_VIEW_ALL act on any conversation in the org", async () => {
    const { service } = createService({ organizationId: "org-1", assignedAgentId: "agent-b", assignedTeamId: null });
    const supervisor = { sub: "supervisor-1", organizationId: "org-1", permissions: [Permission.CONVERSATION_VIEW_ALL] } as never;
    await expect(service.assertConversationAccess(supervisor, "conv-1")).resolves.toBeDefined();
  });

  it("denies act access but allows view access for a past participant transferred away", async () => {
    const { service, prisma } = createService({ organizationId: "org-1", assignedAgentId: "agent-b", assignedTeamId: "team-1" });
    prisma.conversationParticipant.findFirst.mockResolvedValue({ id: "participant-1" });

    await expect(service.assertConversationAccess(agentUser, "conv-1")).rejects.toThrow();
    await expect(service.assertConversationViewAccess(agentUser, "conv-1")).resolves.toBeDefined();
  });

  it("denies view access to someone who was never a participant and holds no other claim", async () => {
    const { service } = createService({ organizationId: "org-1", assignedAgentId: "agent-b", assignedTeamId: "team-2" });
    await expect(service.assertConversationViewAccess(agentUser, "conv-1")).rejects.toThrow();
  });

  it("includes past-participant conversations in myConversations, not just current assignments", async () => {
    const { service, prisma } = createService({ organizationId: "org-1", assignedAgentId: "agent-b", assignedTeamId: "team-1" });
    const findMany = jest.fn().mockResolvedValue([]);
    (prisma.conversation as unknown as { findMany: typeof findMany }).findMany = findMany;

    await service.myConversations(agentUser);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { assignedAgentId: "agent-a" },
            { participants: { some: { userId: "agent-a", participantType: "AGENT" } } },
          ],
        }),
      }),
    );
  });

  it("orders transfer candidates ONLINE, then BUSY, then OFFLINE", async () => {
    const { service, prisma } = createService({ organizationId: "org-1", assignedAgentId: null, assignedTeamId: null });
    prisma.user.findMany.mockResolvedValue([
      { id: "agent-offline", name: "A Offline", email: "a@x.com", agentProfile: { availability: "OFFLINE", activeChatCount: 0, maxConcurrentChats: 5 } },
      { id: "agent-online", name: "B Online", email: "b@x.com", agentProfile: { availability: "ONLINE", activeChatCount: 1, maxConcurrentChats: 5 } },
      { id: "agent-busy", name: "C Busy", email: "c@x.com", agentProfile: { availability: "BUSY", activeChatCount: 5, maxConcurrentChats: 5 } },
    ]);

    const result = await service.transferCandidates(agentUser);

    expect(result.map((c: { userId: string }) => c.userId)).toEqual(["agent-online", "agent-busy", "agent-offline"]);
  });

  it("includes a CS Agent who has no AgentProfile row yet, defaulting to OFFLINE", async () => {
    // Real bug: agentProfile rows are only created at user-creation time, so an agent whose role
    // was changed to cs_agent afterwards (or who predates that logic) has none — querying from
    // AgentProfile instead of User silently dropped them from the transfer list.
    const { service, prisma } = createService({ organizationId: "org-1", assignedAgentId: null, assignedTeamId: null });
    prisma.user.findMany.mockResolvedValue([{ id: "agent-no-profile", name: "No Profile", email: "np@x.com", agentProfile: null }]);

    const result = await service.transferCandidates(agentUser);

    expect(result).toEqual([
      { userId: "agent-no-profile", availability: "OFFLINE", activeChatCount: 0, maxConcurrentChats: 5, user: { name: "No Profile", email: "np@x.com" } },
    ]);
  });

  it("only queries CS Agents as transfer candidates, not other roles", async () => {
    const { service, prisma } = createService({ organizationId: "org-1", assignedAgentId: null, assignedTeamId: null });

    await service.transferCandidates(agentUser);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: { some: { role: { slug: "cs_agent" } } },
        }),
      }),
    );
  });

  it("excludes the caller from their own transfer candidates", async () => {
    const { service, prisma } = createService({ organizationId: "org-1", assignedAgentId: null, assignedTeamId: null });

    await service.transferCandidates(agentUser);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "agent-a" } }),
      }),
    );
  });
});

describe("AgentService.markOfflineOnLogout", () => {
  function createLogoutService(availability: string | null) {
    const prisma = {
      agentProfile: {
        findUnique: jest.fn().mockResolvedValue(availability === null ? null : { availability }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      agentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const realtime = { toOrganizationDashboard: jest.fn() };
    const presence = { broadcastPresence: jest.fn().mockResolvedValue(undefined) };
    const service = new AgentService(prisma as never, realtime as never, presence as never, {} as never);
    return { service, prisma, realtime, presence };
  }

  it("flips an ONLINE agent to OFFLINE and broadcasts it", async () => {
    const { service, prisma, realtime, presence } = createLogoutService("ONLINE");

    await service.markOfflineOnLogout("agent-a", "org-1");

    expect(prisma.agentProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "agent-a" }, update: expect.objectContaining({ availability: "OFFLINE" }) }),
    );
    expect(realtime.toOrganizationDashboard).toHaveBeenCalledWith("org-1", "agent:status", { userId: "agent-a", availability: "OFFLINE" });
    expect(presence.broadcastPresence).toHaveBeenCalledWith("org-1");
  });

  it("does nothing for an agent already OFFLINE", async () => {
    const { service, prisma, realtime } = createLogoutService("OFFLINE");

    await service.markOfflineOnLogout("agent-a", "org-1");

    expect(prisma.agentProfile.upsert).not.toHaveBeenCalled();
    expect(realtime.toOrganizationDashboard).not.toHaveBeenCalled();
  });

  it("does nothing for a user with no AgentProfile — never creates one just because they logged out", async () => {
    const { service, prisma } = createLogoutService(null);

    await service.markOfflineOnLogout("supervisor-1", "org-1");

    expect(prisma.agentProfile.upsert).not.toHaveBeenCalled();
  });
});
