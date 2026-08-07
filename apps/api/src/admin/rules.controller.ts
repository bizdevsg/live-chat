import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { CreateHandoffRuleDto, CreateRoutingRuleDto, CreateTemplateDto, UpdateTemplateDto } from "./dto/admin.dto";

@ApiTags("admin-rules")
@UseGuards(PermissionsGuard)
@Controller("api/v1/admin")
export class RulesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async firstSite(organizationId: string, siteId?: string) {
    if (siteId) return this.prisma.site.findUniqueOrThrow({ where: { id: siteId } });
    return this.prisma.site.findFirstOrThrow({ where: { organizationId } });
  }

  @Get("routing-rules")
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async listRouting(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string) {
    const site = await this.firstSite(user.organizationId, siteId);
    return { success: true, data: await this.prisma.routingRule.findMany({ where: { siteId: site.id }, orderBy: { priority: "desc" } }) };
  }

  @Post("routing-rules")
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async createRouting(@Body() dto: CreateRoutingRuleDto, @CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string) {
    const site = await this.firstSite(user.organizationId, siteId);
    const rule = await this.prisma.routingRule.create({
      data: {
        siteId: site.id,
        name: dto.name,
        priority: dto.priority ?? 0,
        conditions: (dto.conditions ?? {}) as object,
        targetTeamId: dto.targetTeamId,
        strategy: dto.strategy ?? "ROUND_ROBIN",
        isActive: dto.isActive ?? true,
      },
    });
    await this.auditLog.record({ organizationId: user.organizationId, actorType: "USER", actorId: user.sub, action: "routing_rule.created", resourceType: "routing_rule", resourceId: rule.id });
    return { success: true, data: rule };
  }

  @Put("routing-rules/:id")
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async updateRouting(@Param("id") id: string, @Body() dto: Partial<CreateRoutingRuleDto>, @CurrentUser() user: JwtAccessPayload) {
    const rule = await this.prisma.routingRule.update({ where: { id }, data: dto as object });
    await this.auditLog.record({ actorType: "USER", actorId: user.sub, action: "routing_rule.updated", resourceType: "routing_rule", resourceId: id });
    return { success: true, data: rule };
  }

  @Get("handoff-rules")
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async listHandoff(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string) {
    const site = await this.firstSite(user.organizationId, siteId);
    return { success: true, data: await this.prisma.handoffRule.findMany({ where: { siteId: site.id } }) };
  }

  @Post("handoff-rules")
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async createHandoff(@Body() dto: CreateHandoffRuleDto, @CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string) {
    const site = await this.firstSite(user.organizationId, siteId);
    const rule = await this.prisma.handoffRule.create({
      data: { siteId: site.id, reason: dto.reason, targetTeamId: dto.targetTeamId, priority: dto.priority ?? "NORMAL", isActive: dto.isActive ?? true },
    });
    await this.auditLog.record({ organizationId: user.organizationId, actorType: "USER", actorId: user.sub, action: "handoff_rule.created", resourceType: "handoff_rule", resourceId: rule.id });
    return { success: true, data: rule };
  }

  @Put("handoff-rules/:id")
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async updateHandoff(@Param("id") id: string, @Body() dto: Partial<CreateHandoffRuleDto>, @CurrentUser() user: JwtAccessPayload) {
    const rule = await this.prisma.handoffRule.update({ where: { id }, data: dto as object });
    await this.auditLog.record({ actorType: "USER", actorId: user.sub, action: "handoff_rule.updated", resourceType: "handoff_rule", resourceId: id });
    return { success: true, data: rule };
  }

  @Get("templates")
  @RequirePermissions(Permission.TEMPLATE_MANAGE)
  async listTemplates(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.prisma.responseTemplate.findMany({ where: { organizationId: user.organizationId } }) };
  }

  @Post("templates")
  @RequirePermissions(Permission.TEMPLATE_MANAGE)
  async createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: JwtAccessPayload) {
    const template = await this.prisma.responseTemplate.create({
      data: { organizationId: user.organizationId, shortcut: dto.shortcut, title: dto.title, content: dto.content, language: dto.language ?? "id" },
    });
    return { success: true, data: template };
  }

  @Put("templates/:id")
  @RequirePermissions(Permission.TEMPLATE_MANAGE)
  async updateTemplate(@Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    const template = await this.prisma.responseTemplate.update({ where: { id }, data: dto });
    return { success: true, data: template };
  }
}
