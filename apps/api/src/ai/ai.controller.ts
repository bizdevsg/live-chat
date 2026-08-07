import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { UpdateAiConfigurationDto, AiFeedbackDto } from "./dto/ai.dto";

@ApiTags("ai")
@UseGuards(PermissionsGuard)
@Controller("api/v1/ai")
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  @Get("configuration")
  @RequirePermissions(Permission.AI_CONFIG_MANAGE)
  async getConfiguration(@CurrentUser() user: JwtAccessPayload) {
    const config = await this.prisma.aiConfiguration.findFirst({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    return { success: true, data: config };
  }

  @Put("configuration/:id")
  @RequirePermissions(Permission.AI_CONFIG_MANAGE)
  async updateConfiguration(@Param("id") id: string, @Body() dto: UpdateAiConfigurationDto, @CurrentUser() user: JwtAccessPayload) {
    const before = await this.prisma.aiConfiguration.findUniqueOrThrow({ where: { id } });
    const data = await this.prisma.aiConfiguration.update({ where: { id }, data: dto });
    await this.auditLog.record({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.sub,
      action: "ai_config.updated",
      resourceType: "ai_configuration",
      resourceId: id,
      beforeData: before,
      afterData: data,
    });
    return { success: true, data };
  }

  @Get("runs")
  @RequirePermissions(Permission.ANALYTICS_VIEW, Permission.AI_CONFIG_MANAGE)
  async listRuns(@Query("conversationId") conversationId?: string, @Query("page") page = "1") {
    const pageNum = Number(page) || 1;
    const pageSize = 30;
    const where = conversationId ? { conversationId } : {};
    const [items, total] = await Promise.all([
      this.prisma.aiRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiRun.count({ where }),
    ]);
    return { success: true, data: { items, total, page: pageNum, pageSize } };
  }

  @Post("runs/:id/feedback")
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  async feedback(@Param("id") aiRunId: string, @Body() dto: AiFeedbackDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.aiOrchestrator.submitFeedback(aiRunId, user.sub, dto.helpful, dto.used ?? false, dto.edited ?? false);
    return { success: true, data };
  }
}
