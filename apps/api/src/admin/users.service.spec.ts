import { SystemRole } from "@solidchat/shared";
import { UsersService } from "./users.service";

describe("UsersService revokeSessions", () => {
  function createService(roleSlug = "cs_agent") {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ roles: [{ role: { slug: roleSlug } }] }),
        findMany: jest.fn().mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]),
      },
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const realtime = { disconnectAgent: jest.fn() };
    const service = new UsersService(prisma as never, auditLog as never, realtime as never);

    return { service, prisma, auditLog, realtime };
  }

  it("revokes every active session for a non-Superadmin in the same organization", async () => {
    const { service, prisma, auditLog, realtime } = createService();

    await service.revokeSessions("user-1", "org-1", "actor-1");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user-1", organizationId: "org-1" },
      select: { roles: { select: { role: { select: { slug: true } } } } },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      actorId: "actor-1",
      action: "user.sessions_revoked",
      resourceId: "user-1",
    }));
    expect(realtime.disconnectAgent).toHaveBeenCalledWith("user-1");
  });

  it("refuses to revoke a Superadmin session", async () => {
    const { service, prisma, auditLog, realtime } = createService(SystemRole.SUPER_ADMIN);

    await expect(service.revokeSessions("superadmin-1", "org-1", "actor-1")).rejects.toThrow(
      "Sesi Superadmin tidak dapat dicabut melalui manajemen user.",
    );
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
    expect(realtime.disconnectAgent).not.toHaveBeenCalled();
  });

  it("does not expose users from another organization", async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.revokeSessions("user-2", "org-1", "actor-1")).rejects.toThrow("User tidak ditemukan.");
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it("revokes all non-Superadmin sessions in the organization at once", async () => {
    const { service, prisma, auditLog, realtime } = createService();
    prisma.session.updateMany.mockResolvedValue({ count: 4 });

    await expect(
      service.revokeAllNonSuperAdminSessions("org-1", "superadmin-1", [SystemRole.SUPER_ADMIN]),
    ).resolves.toEqual({ usersRevoked: 2, sessionsRevoked: 4 });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        roles: { none: { role: { slug: SystemRole.SUPER_ADMIN } } },
      },
      select: { id: true },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: { in: ["user-1", "user-2"] }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(realtime.disconnectAgent).toHaveBeenCalledTimes(2);
    expect(realtime.disconnectAgent).toHaveBeenCalledWith("user-1");
    expect(realtime.disconnectAgent).toHaveBeenCalledWith("user-2");
    expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      actorId: "superadmin-1",
      action: "users.sessions_revoked",
      afterData: { usersRevoked: 2, sessionsRevoked: 4 },
    }));
  });

  it("allows only a Superadmin to revoke all sessions", async () => {
    const { service, prisma, realtime } = createService();

    await expect(service.revokeAllNonSuperAdminSessions("org-1", "admin-1", ["admin"])).rejects.toThrow(
      "Hanya Superadmin yang dapat mencabut sesi seluruh user sekaligus.",
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
    expect(realtime.disconnectAgent).not.toHaveBeenCalled();
  });
});
