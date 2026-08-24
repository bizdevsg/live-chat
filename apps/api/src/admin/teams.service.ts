import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";
import type { CreateTeamDto, UpdateTeamDto } from "./dto/admin.dto";

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.team.findMany({
      where: { organizationId },
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async listUserCandidates(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async create(organizationId: string, dto: CreateTeamDto, actorId: string) {
    const team = await this.prisma.team.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        capacityPerAgent: dto.capacityPerAgent ?? 5,
        routingPriority: dto.routingPriority ?? 0,
        supervisorId: dto.supervisorId,
      },
    });
    await this.auditLog.record({ organizationId, actorType: "USER", actorId, action: "team.created", resourceType: "team", resourceId: team.id });
    return team;
  }

  private async findTeam(id: string, organizationId: string) {
    const team = await this.prisma.team.findFirst({ where: { id, organizationId } });
    if (!team) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Tim tidak ditemukan.");
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, organizationId: string, actorId: string) {
    await this.findTeam(id, organizationId);
    const team = await this.prisma.team.update({
      where: { id },
      data: dto,
    });
    await this.auditLog.record({ actorType: "USER", actorId, action: "team.updated", resourceType: "team", resourceId: id });
    return team;
  }

  async addMember(teamId: string, userId: string, organizationId: string) {
    await this.findTeam(teamId, organizationId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "User tidak ditemukan.");
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: {},
      create: { teamId, userId },
    });
  }

  async removeMember(teamId: string, userId: string, organizationId: string) {
    await this.findTeam(teamId, organizationId);
    await this.prisma.teamMember.deleteMany({ where: { teamId, userId } });
  }

  async remove(id: string, organizationId: string, actorId: string) {
    await this.findTeam(id, organizationId);
    await this.prisma.$transaction([
      this.prisma.conversation.updateMany({ where: { assignedTeamId: id }, data: { assignedTeamId: null } }),
      this.prisma.routingRule.updateMany({ where: { targetTeamId: id }, data: { targetTeamId: null } }),
      this.prisma.handoffRule.updateMany({ where: { targetTeamId: id }, data: { targetTeamId: null } }),
      this.prisma.team.delete({ where: { id } }),
    ]);
    await this.auditLog.record({ organizationId, actorType: "USER", actorId, action: "team.deleted", resourceType: "team", resourceId: id });
  }
}
