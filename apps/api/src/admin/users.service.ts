import { Injectable, HttpStatus } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { ErrorCode } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { ApiException, NotFoundApiException } from "../common/errors/api.exception";
import type { CreateUserDto, InviteUserDto, UpdateUserDto } from "./dto/admin.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      include: { roles: { include: { role: true } }, teamMembers: { include: { team: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  private async attachRoles(userId: string, organizationId: string, roleSlugs: string[]) {
    const roles = await this.prisma.role.findMany({ where: { organizationId, slug: { in: roleSlugs } } });
    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })) });
  }

  async create(organizationId: string, dto: CreateUserDto, actorId: string) {
    const temporaryPassword = nanoid(16);
    const passwordHash = await hash(temporaryPassword);
    const user = await this.prisma.user.create({
      data: { organizationId, email: dto.email, name: dto.name, passwordHash, isActive: true },
    });
    await this.attachRoles(user.id, organizationId, dto.roleSlugs);
    if (dto.teamId) {
      await this.prisma.teamMember.create({ data: { teamId: dto.teamId, userId: user.id } });
      const isAgentRole = dto.roleSlugs.includes("cs_agent");
      if (isAgentRole) await this.prisma.agentProfile.create({ data: { userId: user.id } });
    }
    await this.auditLog.record({ organizationId, actorType: "USER", actorId, action: "user.created", resourceType: "user", resourceId: user.id });
    return { ...user, temporaryPassword };
  }

  async update(id: string, dto: UpdateUserDto, organizationId: string, actorId: string) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const user = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive, supervisorId: dto.supervisorId },
    });
    if (dto.roleSlugs) await this.attachRoles(id, organizationId, dto.roleSlugs);
    await this.auditLog.record({
      organizationId,
      actorType: "USER",
      actorId,
      action: "user.updated",
      resourceType: "user",
      resourceId: id,
      beforeData: { isActive: before.isActive },
      afterData: { isActive: user.isActive },
    });
    return user;
  }

  async revokeSessions(id: string, actorId: string) {
    await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.auditLog.record({ actorType: "USER", actorId, action: "user.sessions_revoked", resourceType: "user", resourceId: id });
  }

  async invite(organizationId: string, dto: InviteUserDto, invitedById: string) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new ApiException(ErrorCode.CONFLICT, "User dengan email ini sudah ada.", HttpStatus.CONFLICT);

    const rawToken = nanoid(32);
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: dto.email,
        roleSlug: dto.roleSlug,
        invitedById,
        tokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`[admin] Invitation link for ${dto.email}: /accept-invitation?token=${rawToken}`);
    await this.auditLog.record({ organizationId, actorType: "USER", actorId: invitedById, action: "user.invited", resourceType: "invitation", resourceId: invitation.id });
    return invitation;
  }

  async roles(organizationId: string) {
    return this.prisma.role.findMany({ where: { organizationId }, include: { permissions: { include: { permission: true } } } });
  }

  async getOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "User tidak ditemukan.");
    return user;
  }
}
