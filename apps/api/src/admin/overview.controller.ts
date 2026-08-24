import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConversationStatus, Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { CreateIntegrationDto, UpdateIntegrationDto } from "./dto/admin.dto";

@ApiTags("admin-overview")
@UseGuards(PermissionsGuard)
@Controller("api/v1/admin")
export class OverviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get("overview")
  @RequirePermissions(Permission.ANALYTICS_VIEW)
  async overview(@CurrentUser() user: JwtAccessPayload) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalToday,
      active,
      waitingAgent,
      aiResolved,
      handoff,
      unresolved,
      openTickets,
      agentsOnline,
      csatAgg,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { organizationId: user.organizationId, createdAt: { gte: startOfDay } } }),
      this.prisma.conversation.count({
        where: { organizationId: user.organizationId, status: { in: [ConversationStatus.AI_ACTIVE, ConversationStatus.AGENT_ACTIVE, ConversationStatus.WAITING_CUSTOMER] } },
      }),
      this.prisma.conversation.count({ where: { organizationId: user.organizationId, status: { in: [ConversationStatus.QUEUED, ConversationStatus.WAITING_AGENT] } } }),
      this.prisma.conversation.count({ where: { organizationId: user.organizationId, status: ConversationStatus.RESOLVED, handlerType: "AI" } }),
      this.prisma.conversation.count({ where: { organizationId: user.organizationId, handoffReason: { not: null }, createdAt: { gte: startOfDay } } }),
      this.prisma.conversation.count({ where: { organizationId: user.organizationId, status: { notIn: [ConversationStatus.RESOLVED, ConversationStatus.CLOSED] } } }),
      this.prisma.ticket.count({ where: { organizationId: user.organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      this.prisma.agentProfile.count({ where: { availability: "ONLINE", user: { organizationId: user.organizationId } } }),
      this.prisma.customerFeedback.aggregate({ _avg: { score: true }, where: { conversation: { organizationId: user.organizationId } } }),
    ]);

    const totalConversations = await this.prisma.conversation.count({ where: { organizationId: user.organizationId } });
    const aiHandled = await this.prisma.conversation.count({ where: { organizationId: user.organizationId, handlerType: "AI" } });

    return {
      success: true,
      data: {
        totalChatToday: totalToday,
        activeConversations: active,
        waitingAgent,
        aiResolvedCount: aiResolved,
        handoffCount: handoff,
        unresolvedCount: unresolved,
        openTickets,
        agentsOnline,
        aiContainmentRate: totalConversations > 0 ? aiHandled / totalConversations : 0,
        customerSatisfactionAvg: csatAgg._avg.score ?? null,
      },
    };
  }

  @Get("audit-logs")
  @RequirePermissions(Permission.AUDIT_LOG_VIEW)
  async auditLogs(
    @CurrentUser() user: JwtAccessPayload,
    @Query("page") page = "1",
    @Query("resourceType") resourceType?: string,
    @Query("actorId") actorId?: string,
  ) {
    const pageNum = Number(page) || 1;
    const pageSize = 50;
    const where = { organizationId: user.organizationId, resourceType: resourceType || undefined, actorId: actorId || undefined };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * pageSize, take: pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { success: true, data: { items, total, page: pageNum, pageSize } };
  }

  @Get("integrations")
  @RequirePermissions(Permission.INTEGRATION_MANAGE, Permission.SECURITY_MANAGE)
  async integrations(@CurrentUser() user: JwtAccessPayload) {
    const data = await this.prisma.integration.findMany({
      where: { organizationId: user.organizationId },
      include: { logs: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    return { success: true, data };
  }

  @Post("integrations")
  @RequirePermissions(Permission.INTEGRATION_MANAGE)
  async createIntegration(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateIntegrationDto) {
    const data = await this.prisma.integration.create({
      data: {
        organizationId: user.organizationId,
        type: dto.type,
        provider: dto.provider,
        name: dto.name,
        config: (dto.config ?? {}) as object,
        isActive: dto.isActive ?? true,
      },
      include: { logs: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    await this.auditLog.record({ organizationId: user.organizationId, actorType: "USER", actorId: user.sub, action: "integration.created", resourceType: "integration", resourceId: data.id });
    return { success: true, data };
  }

  @Put("integrations/:id")
  @RequirePermissions(Permission.INTEGRATION_MANAGE)
  async updateIntegration(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateIntegrationDto) {
    const data = await this.prisma.integration.update({
      where: { id },
      data: {
        type: dto.type,
        provider: dto.provider,
        name: dto.name,
        config: dto.config as object | undefined,
        isActive: dto.isActive,
      },
      include: { logs: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    await this.auditLog.record({ organizationId: user.organizationId, actorType: "USER", actorId: user.sub, action: "integration.updated", resourceType: "integration", resourceId: id });
    return { success: true, data };
  }

  @Delete("integrations/:id")
  @RequirePermissions(Permission.INTEGRATION_MANAGE)
  async deleteIntegration(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.prisma.integration.delete({ where: { id } });
    await this.auditLog.record({ organizationId: user.organizationId, actorType: "USER", actorId: user.sub, action: "integration.deleted", resourceType: "integration", resourceId: id });
    return { success: true, data: null };
  }

  @Get("security-events")
  @RequirePermissions(Permission.SECURITY_MANAGE, Permission.AUDIT_LOG_VIEW)
  async securityEvents(@CurrentUser() user: JwtAccessPayload, @Query("page") page = "1") {
    const pageNum = Number(page) || 1;
    const pageSize = 50;
    const where = { organizationId: user.organizationId };
    const [items, total] = await Promise.all([
      this.prisma.securityEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * pageSize, take: pageSize }),
      this.prisma.securityEvent.count({ where }),
    ]);
    return { success: true, data: { items, total, page: pageNum, pageSize } };
  }
}
