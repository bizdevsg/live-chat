import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AnalyticsService, type AnalyticsFilter } from "./analytics.service";

@ApiTags("analytics")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.ANALYTICS_VIEW)
@Controller("api/v1/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private buildFilter(user: JwtAccessPayload, siteId?: string, from?: string, to?: string): AnalyticsFilter {
    return {
      organizationId: user.organizationId,
      siteId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
  }

  @Get("overview")
  async overview(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.analyticsService.overview(this.buildFilter(user, siteId, from, to)) };
  }

  @Get("conversations")
  async conversations(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.analyticsService.conversationsVolume(this.buildFilter(user, siteId, from, to)) };
  }

  @Get("agents")
  async agents(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.analyticsService.agentsPerformance(user.organizationId) };
  }

  @Get("ai")
  async ai(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.analyticsService.aiPerformance(this.buildFilter(user, siteId, from, to)) };
  }

  @Get("intents")
  async intents(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.analyticsService.topIntents(this.buildFilter(user, siteId, from, to)) };
  }

  @Get("knowledge-gaps")
  async knowledgeGaps(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.analyticsService.knowledgeGaps(this.buildFilter(user, siteId, from, to)) };
  }

  @Get("customer-satisfaction")
  async csat(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.analyticsService.customerSatisfaction(this.buildFilter(user, siteId, from, to)) };
  }

  @Get("export")
  async export(@CurrentUser() user: JwtAccessPayload, @Res() res: Response, @Query("siteId") siteId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    const filter = this.buildFilter(user, siteId, from, to);
    const [overview, intents] = await Promise.all([this.analyticsService.overview(filter), this.analyticsService.topIntents(filter)]);

    const rows = [
      "metric,value",
      `totalConversations,${overview.totalConversations}`,
      `aiContainmentRate,${overview.aiContainmentRate}`,
      `handoffRate,${overview.handoffRate}`,
      `resolvedRate,${overview.resolvedRate}`,
      `ticketCount,${overview.ticketCount}`,
      `leadCount,${overview.leadCount}`,
      "",
      "intent,count",
      ...intents.map((i) => `${i.intent},${i.count}`),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=solidchat-analytics.csv");
    res.send(rows.join("\n"));
  }
}
