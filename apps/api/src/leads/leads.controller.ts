import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { LeadsService } from "./leads.service";

@ApiTags("leads")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.LEAD_VIEW)
@Controller("api/v1/leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload, @Query("siteId") siteId?: string) {
    const data = await this.leadsService.list(user.organizationId, siteId);
    return { success: true, data };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const data = await this.leadsService.getOrThrow(id);
    return { success: true, data };
  }

  @Post(":id/retry")
  async retry(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.leadsService.manualRetry(id, user.sub);
    return { success: true, data };
  }
}
