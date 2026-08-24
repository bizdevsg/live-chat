import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TeamsService } from "./teams.service";
import { CreateTeamDto, TeamMemberDto, UpdateTeamDto } from "./dto/admin.dto";

@ApiTags("admin-teams")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.TEAM_MANAGE)
@Controller("api/v1/admin/teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.list(user.organizationId) };
  }

  @Get("candidates")
  async candidates(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.listUserCandidates(user.organizationId) };
  }

  @Post()
  async create(@Body() dto: CreateTeamDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.create(user.organizationId, dto, user.sub) };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateTeamDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.update(id, dto, user.organizationId, user.sub) };
  }

  @Post(":id/members")
  async addMember(@Param("id") id: string, @Body() dto: TeamMemberDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.addMember(id, dto.userId, user.organizationId) };
  }

  @Delete(":id/members/:userId")
  async removeMember(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: JwtAccessPayload) {
    await this.teamsService.removeMember(id, userId, user.organizationId);
    return { success: true, data: null };
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.teamsService.remove(id, user.organizationId, user.sub);
    return { success: true, data: null };
  }
}
