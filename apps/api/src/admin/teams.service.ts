import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
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

  async update(id: string, dto: UpdateTeamDto, actorId: string) {
    const team = await this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        capacityPerAgent: dto.capacityPerAgent,
        routingPriority: dto.routingPriority,
        supervisorId: dto.supervisorId,
        isActive: dto.isActive,
      },
    });
    await this.auditLog.record({ actorType: "USER", actorId, action: "team.updated", resourceType: "team", resourceId: id });
    return team;
  }

  async addMember(teamId: string, userId: string) {
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: {},
      create: { teamId, userId },
    });
  }

  async removeMember(teamId: string, userId: string) {
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } }).catch(() => undefined);
  }
}
