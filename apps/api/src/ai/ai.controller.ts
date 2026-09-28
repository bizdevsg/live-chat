import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ErrorCode, Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { AiProviderFactory } from "./ai-provider.factory";
import { UpdateAiConfigurationDto, AiFeedbackDto, AiKnowledgeTestDto } from "./dto/ai.dto";
import { ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";

const ANSWER_PROMPT_PURPOSE = "ANSWER";
const DEFAULT_AI_NAME = "Asisten Virtual";
const DEFAULT_GREETING = "Halo! Ada yang bisa kami bantu?";
const HANDOFF_EVENT_TYPES = ["handoff.requested", "handoff.unavailable_no_agent", "handoff.deferred_no_team"];

function getEventPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

@ApiTags("ai")
@UseGuards(PermissionsGuard)
@Controller("api/v1/ai")
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  private async resolveSiteForConfiguration(organizationId: string, siteId?: string | null) {
    if (siteId) {
      return this.prisma.site.findUnique({ where: { id: siteId } });
    }

    return this.prisma.site.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  private async buildConfigurationResponse(organizationId: string) {
    const config = await this.aiProviderFactory.getConfigForOrganization(organizationId);
    if (!config) return null;

    const [site, prompt] = await Promise.all([
      this.resolveSiteForConfiguration(organizationId, config.siteId),
      this.prisma.aiPrompt.findFirst({
        where: {
          aiConfigurationId: config.id,
          purpose: ANSWER_PROMPT_PURPOSE,
          isActive: true,
        },
        orderBy: { version: "desc" },
      }),
    ]);

    return {
      ...config,
      aiName: site?.aiName ?? DEFAULT_AI_NAME,
      greeting: site?.greeting ?? DEFAULT_GREETING,
      systemPrompt: prompt?.content ?? "",
    };
  }

  @Get("configuration")
  @RequirePermissions(Permission.AI_CONFIG_MANAGE)
  async getConfiguration(@CurrentUser() user: JwtAccessPayload) {
    const config = await this.buildConfigurationResponse(user.organizationId);
    return { success: true, data: config };
  }

  @Put("configuration/:id")
  @RequirePermissions(Permission.AI_CONFIG_MANAGE)
  async updateConfiguration(@Param("id") id: string, @Body() dto: UpdateAiConfigurationDto, @CurrentUser() user: JwtAccessPayload) {
    const before = await this.prisma.aiConfiguration.findUniqueOrThrow({ where: { id } });
    if (before.organizationId !== user.organizationId) {
      throw new ForbiddenApiException("Anda tidak memiliki akses ke konfigurasi AI ini.");
    }

    const { aiName, greeting, systemPrompt, ...configData } = dto;
    const site = await this.resolveSiteForConfiguration(user.organizationId, before.siteId);
    const beforePrompt = await this.prisma.aiPrompt.findFirst({
      where: { aiConfigurationId: id, purpose: ANSWER_PROMPT_PURPOSE, isActive: true },
      orderBy: { version: "desc" },
    });

    const data = await this.prisma.aiConfiguration.update({
      where: { id },
      data: configData,
    });

    if (site && (aiName !== undefined || greeting !== undefined)) {
      await this.prisma.site.update({
        where: { id: site.id },
        data: {
          ...(aiName !== undefined ? { aiName: aiName.trim() || DEFAULT_AI_NAME } : {}),
          ...(greeting !== undefined ? { greeting: greeting.trim() || DEFAULT_GREETING } : {}),
        },
      });
    }

    if (systemPrompt !== undefined) {
      const normalizedPrompt = systemPrompt.trim();
      await this.prisma.$transaction(async (tx) => {
        if (!normalizedPrompt) {
          await tx.aiPrompt.updateMany({
            where: { aiConfigurationId: id, purpose: ANSWER_PROMPT_PURPOSE, isActive: true },
            data: { isActive: false },
          });
          return;
        }

        // Create first, then retire the previous version in the same transaction. A database
        // constraint/error (such as an oversized prompt) must never leave the site without an
        // active system prompt.
        const nextPrompt = await tx.aiPrompt.create({
          data: {
            aiConfigurationId: id,
            purpose: ANSWER_PROMPT_PURPOSE,
            content: normalizedPrompt,
            version: (beforePrompt?.version ?? 0) + 1,
            isActive: true,
          },
        });
        await tx.aiPrompt.updateMany({
          where: { aiConfigurationId: id, purpose: ANSWER_PROMPT_PURPOSE, isActive: true, id: { not: nextPrompt.id } },
          data: { isActive: false },
        });
      });
    }

    const afterData = await this.buildConfigurationResponse(user.organizationId);
    await this.auditLog.record({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.sub,
      action: "ai_config.updated",
      resourceType: "ai_configuration",
      resourceId: id,
      beforeData: {
        ...before,
        aiName: site?.aiName ?? DEFAULT_AI_NAME,
        greeting: site?.greeting ?? DEFAULT_GREETING,
        systemPrompt: beforePrompt?.content ?? "",
      },
      afterData,
    });

    return { success: true, data: afterData ?? data };
  }

  @Get("runs")
  @RequirePermissions(Permission.ANALYTICS_VIEW, Permission.AI_CONFIG_MANAGE)
  async listRuns(
    @CurrentUser() user: JwtAccessPayload,
    @Query("conversationId") conversationId?: string,
    @Query("page") page = "1",
  ) {
    const pageNum = Number(page) || 1;
    const pageSize = 30;
    const where = {
      conversationId: conversationId || undefined,
      conversation: { organizationId: user.organizationId },
    };
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

  @Get("handoffs")
  @RequirePermissions(Permission.ANALYTICS_VIEW, Permission.AI_CONFIG_MANAGE)
  async listHandoffs(@CurrentUser() user: JwtAccessPayload) {
    const events = await this.prisma.conversationEvent.findMany({
      where: {
        type: { in: HANDOFF_EVENT_TYPES },
        conversation: { organizationId: user.organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        conversationId: true,
        type: true,
        payload: true,
        createdAt: true,
        conversation: { select: { status: true, handlerType: true } },
      },
    });

    return {
      success: true,
      data: {
        items: events.map((event) => ({
          id: event.id,
          conversationId: event.conversationId,
          eventType: event.type,
          reason: getEventPayloadString(event.payload, "reason") ?? "UNSPECIFIED",
          source: getEventPayloadString(event.payload, "source") ?? "UNKNOWN",
          outcome: getEventPayloadString(event.payload, "outcome"),
          createdAt: event.createdAt,
          conversation: event.conversation,
        })),
      },
    };
  }

  @Get("runs/:id")
  @RequirePermissions(Permission.ANALYTICS_VIEW, Permission.AI_CONFIG_MANAGE)
  async getRunDetail(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const run = await this.prisma.aiRun.findFirst({
      where: {
        id,
        conversation: { organizationId: user.organizationId },
      },
      include: {
        messages: { orderBy: { role: "asc" } },
        toolCalls: { orderBy: { createdAt: "asc" } },
        feedback: { orderBy: { createdAt: "desc" } },
        conversation: {
          select: {
            status: true,
            handlerType: true,
            handoffReason: true,
          },
        },
      },
    });
    if (!run) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "AI run tidak ditemukan.");

    const handoffWindowEndsAt = new Date(run.createdAt.getTime() + 5 * 60 * 1000);
    const handoffEvent = run.handoffRequired
      ? await this.prisma.conversationEvent.findFirst({
          where: {
            conversationId: run.conversationId,
            type: { in: HANDOFF_EVENT_TYPES },
            createdAt: { gte: run.createdAt, lte: handoffWindowEndsAt },
          },
          orderBy: { createdAt: "asc" },
          select: { type: true, payload: true, createdAt: true },
        })
      : null;

    return {
      success: true,
      data: {
        ...run,
        handoffReason: run.handoffRequired
          ? getEventPayloadString(handoffEvent?.payload, "reason") ?? run.conversation.handoffReason ?? "UNSPECIFIED"
          : null,
        handoffSource: run.handoffRequired
          ? getEventPayloadString(handoffEvent?.payload, "source") ?? "UNKNOWN"
          : null,
        handoffEventType: handoffEvent?.type ?? null,
        handoffEventAt: handoffEvent?.createdAt ?? null,
      },
    };
  }

  @Post("runs/:id/feedback")
  @RequirePermissions(Permission.CONVERSATION_HANDLE)
  async feedback(@Param("id") aiRunId: string, @Body() dto: AiFeedbackDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.aiOrchestrator.submitFeedback(aiRunId, user.sub, dto.helpful, dto.used ?? false, dto.edited ?? false);
    return { success: true, data };
  }

  @Post("test-answer")
  @RequirePermissions(Permission.KNOWLEDGE_EDIT, Permission.KNOWLEDGE_APPROVE, Permission.AUDIT_LOG_VIEW, Permission.AI_CONFIG_MANAGE)
  async testAnswer(@Body() dto: AiKnowledgeTestDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.aiOrchestrator.previewKnowledgeAnswer(user.organizationId, dto.message);
    return { success: true, data };
  }
}
