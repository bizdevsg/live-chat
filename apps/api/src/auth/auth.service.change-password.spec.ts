import { hashPassword, verifyPassword } from "./password-hashing.util";
import { AuthService } from "./auth.service";

describe("AuthService.changePassword", () => {
  async function createService() {
    const currentPasswordHash = await hashPassword("old-password");
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          passwordHash: currentPasswordHash,
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn().mockImplementation((operations) => Promise.all(operations)),
    };
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      auditLog as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, prisma, auditLog };
  }

  it("changes the password and revokes every session except the current one", async () => {
    const { service, prisma, auditLog } = await createService();

    await service.changePassword("user-1", "session-current", "old-password", "New-password1!");

    const passwordHash = prisma.user.update.mock.calls[0][0].data.passwordHash as string;
    await expect(verifyPassword(passwordHash, "New-password1!")).resolves.toBe(true);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "session-current" }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.password_changed" }));
  });

  it("rejects an incorrect current password without changing anything", async () => {
    const { service, prisma } = await createService();

    await expect(service.changePassword("user-1", "session-current", "incorrect", "new-password")).rejects.toThrow(
      "Password saat ini salah.",
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });
});
