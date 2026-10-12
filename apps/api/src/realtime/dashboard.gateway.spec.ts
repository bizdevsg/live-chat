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
    };
    const authService = { logout: jest.fn().mockResolvedValue(undefined) };
    const fetchSockets = jest.fn().mockResolvedValue(connectedSockets);
    const server = { in: jest.fn().mockReturnValue({ fetchSockets }) };
    const gateway = new DashboardGateway(
      jwt as never,
      config as never,
      prisma as never,
      agentService as never,
      authService as never,
      {} as never,
      {} as never,
      {} as never,
    );
    gateway.server = server as never;

    return { gateway, agentService, authService, fetchSockets };
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

  it("revokes the session and marks the agent offline after ten seconds without a reconnect", async () => {
    const { gateway, agentService, authService } = createGateway();

    gateway.handleDisconnect(disconnectedClient());
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS - 1);
    expect(authService.logout).not.toHaveBeenCalled();
    expect(agentService.markOfflineOnDisconnect).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);

    expect(authService.logout).toHaveBeenCalledWith("session-1");
    expect(agentService.markOfflineOnDisconnect).toHaveBeenCalledWith("agent-1", "org-1");
  });

  it("keeps the session active and agent online while another dashboard tab remains", async () => {
    const { gateway, agentService, authService } = createGateway([{ id: "other-tab" }]);

    gateway.handleDisconnect(disconnectedClient());
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS);

    expect(authService.logout).not.toHaveBeenCalled();
    expect(agentService.markOfflineOnDisconnect).not.toHaveBeenCalled();
  });

  it("cancels logout when the dashboard reconnects during the grace period", async () => {
    const { gateway, agentService, authService } = createGateway();
    const emit = jest.fn();
    const reconnectingClient = {
      data: {},
      handshake: { auth: { accessToken: "access-token" }, headers: {} },
      join: jest.fn().mockResolvedValue(undefined),
      emit,
      disconnect: jest.fn(),
    } as never;

    gateway.handleDisconnect(disconnectedClient());
    await jest.advanceTimersByTimeAsync(DASHBOARD_DISCONNECT_GRACE_MS - 1);
    await gateway.handleConnection(reconnectingClient);
    await jest.advanceTimersByTimeAsync(1);

    expect(authService.logout).not.toHaveBeenCalled();
    expect(agentService.markOfflineOnDisconnect).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("dashboard:ready", { userId: "agent-1" });
  });
});
