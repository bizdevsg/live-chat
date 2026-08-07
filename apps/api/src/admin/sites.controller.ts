import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SitesService } from "./sites.service";
import { AddDomainDto, CreateSiteDto, UpdateSiteDto, UpdateWidgetSettingsDto } from "./dto/admin.dto";

@ApiTags("admin-sites")
@UseGuards(PermissionsGuard)
@Controller("api/v1/admin/sites")
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @RequirePermissions(Permission.SITE_MANAGE, Permission.WIDGET_MANAGE)
  async list(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.sitesService.list(user.organizationId) };
  }

  @Get(":id")
  @RequirePermissions(Permission.SITE_MANAGE, Permission.WIDGET_MANAGE)
  async get(@Param("id") id: string) {
    return { success: true, data: await this.sitesService.getOrThrow(id) };
  }

  @Post()
  @RequirePermissions(Permission.SITE_MANAGE)
  async create(@Body() dto: CreateSiteDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.sitesService.create(user.organizationId, dto, user.sub) };
  }

  @Put(":id")
  @RequirePermissions(Permission.SITE_MANAGE)
  async update(@Param("id") id: string, @Body() dto: UpdateSiteDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.sitesService.update(id, dto, user.sub) };
  }

  @Post(":id/domains")
  @RequirePermissions(Permission.SITE_MANAGE)
  async addDomain(@Param("id") id: string, @Body() dto: AddDomainDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.sitesService.addDomain(id, dto, user.sub) };
  }

  @Delete("domains/:domainId")
  @RequirePermissions(Permission.SITE_MANAGE)
  async removeDomain(@Param("domainId") domainId: string, @CurrentUser() user: JwtAccessPayload) {
    await this.sitesService.removeDomain(domainId, user.sub);
    return { success: true, data: null };
  }

  @Put(":id/widget-settings")
  @RequirePermissions(Permission.WIDGET_MANAGE)
  async updateWidgetSettings(@Param("id") id: string, @Body() dto: UpdateWidgetSettingsDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.sitesService.updateWidgetSettings(id, dto, user.sub) };
  }
}
