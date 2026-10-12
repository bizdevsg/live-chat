import { DASHBOARD_DISCONNECT_GRACE_MS, DashboardGateway } from "./dashboard.gateway";

describe("DashboardGateway automatic disconnect presence", () => {
  const user = {
    sub: "agent-1",
    organizationId: "org-1",
    sessionId: "session-1",
    roles: [],
    permissions: [],
  };

  function createGateway(connectedSockets: unknown[] = []) {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(user) };
    const config = { get: jest.fn().mockReturnValue("jwt-secret") };
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ revokedAt: null }) },
      teamMember: { findMany: jest.fn().mockResolvedValue([]) },
      site: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const agentService = {
      markOfflineOnDisconnect: jest.fn().mockResolvedValue(true),
      markOnlineOnLogin: jest.fn().mockResolvedValue(undefined),
    };
    const fetchSockets = jest.fn().mockResolvedValue(connectedSockets);
    const server = { in: jest.fn().mockReturnValue({ fetchSockets }) };
    const gateway = new DashboardGateway(
      jwt as never,
      config as never,
      prisma as never,
      agentService as never,
      {} as never,
      {} as never,
      {} as never,
    );
    gateway.server = server as never;

    return { gateway, agentService, fetchSockets };
  }

  function disconnectedClient() {
    return { data: { user } } as never;
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks the agent offline only after the disconnect grace period", async () => {
    const { gateway, agentService } = createGateway();

    gateway.handleDisconnect(disconnectedClient());
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS - 1);
    expect(agentService.markOfflineOnDisconnect).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(agentService.markOfflineOnDisconnect).toHaveBeenCalledWith("agent-1", "org-1");
  });

  it("keeps the agent online while another dashboard socket remains", async () => {
    const { gateway, agentService } = createGateway([{ id: "other-tab" }]);

    gateway.handleDisconnect(disconnectedClient());
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS);

    expect(agentService.markOfflineOnDisconnect).not.toHaveBeenCalled();
  });

  it("cancels pending auto-offline when the dashboard reconnects", async () => {
    const { gateway, agentService } = createGateway();
    const reconnectingClient = {
      data: {},
      handshake: { auth: { accessToken: "access-token" }, headers: {} },
      join: jest.fn().mockResolvedValue(undefined),
    } as never;

    gateway.handleDisconnect(disconnectedClient());
    await gateway.handleConnection(reconnectingClient);
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS);

    expect(agentService.markOfflineOnDisconnect).not.toHaveBeenCalled();
  });

  it("restores ONLINE after an agent reconnects following an automatic offline", async () => {
    const { gateway, agentService } = createGateway();
    const reconnectingClient = {
      data: {},
      handshake: { auth: { accessToken: "access-token" }, headers: {} },
      join: jest.fn().mockResolvedValue(undefined),
    } as never;

    gateway.handleDisconnect(disconnectedClient());
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS);
    await gateway.handleConnection(reconnectingClient);

    expect(agentService.markOfflineOnDisconnect).toHaveBeenCalledWith("agent-1", "org-1");
    expect(agentService.markOnlineOnLogin).toHaveBeenCalledWith("agent-1", "org-1");
  });
});
