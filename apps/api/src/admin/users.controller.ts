import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto, InviteUserDto, UpdateUserDto } from "./dto/admin.dto";

@ApiTags("admin-users")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.USER_MANAGE)
@Controller("api/v1/admin/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.usersService.list(user.organizationId) };
  }

  @Get("roles")
  async roles(@CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.usersService.roles(user.organizationId) };
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.usersService.create(user.organizationId, dto, user.sub) };
  }

  @Post("invite")
  async invite(@Body() dto: InviteUserDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.usersService.invite(user.organizationId, dto, user.sub) };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtAccessPayload) {
    return { success: true, data: await this.usersService.update(id, dto, user.organizationId, user.sub) };
  }

  @Post(":id/revoke-sessions")
  async revoke(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.usersService.revokeSessions(id, user.sub);
    return { success: true, data: null };
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    await this.usersService.remove(id, user.organizationId, user.sub);
    return { success: true, data: null };
  }
}
