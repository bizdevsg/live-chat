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

  @Post()
  async create(@Body() dto: CreateTeamDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.create(user.organizationId, dto, user.sub) };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateTeamDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.teamsService.update(id, dto, user.sub) };
  }

  @Post(":id/members")
  async addMember(@Param("id") id: string, @Body() dto: TeamMemberDto) {
    return { success: true, data: await this.teamsService.addMember(id, dto.userId) };
  }

  @Delete(":id/members/:userId")
  async removeMember(@Param("id") id: string, @Param("userId") userId: string) {
    await this.teamsService.removeMember(id, userId);
    return { success: true, data: null };
  }
}
