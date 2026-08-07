import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TicketsService } from "./tickets.service";
import { PrismaService } from "../prisma/prisma.service";
import { AssignTicketDto, CreateTicketCommentDto, CreateTicketDto, ResolveTicketDto, UpdateTicketDto } from "./dto/ticket.dto";

@ApiTags("tickets")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.TICKET_MANAGE)
@Controller("api/v1/tickets")
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload, @Query("status") status?: string, @Query("siteId") siteId?: string, @Query("page") page?: string) {
    const data = await this.ticketsService.list(user.organizationId, { status, siteId, page: page ? Number(page) : undefined });
    return { success: true, data };
  }

  @Post()
  async create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateTicketDto) {
    const site = await this.prisma.site.findFirstOrThrow({ where: { organizationId: user.organizationId } });
    const data = await this.ticketsService.create(user.organizationId, site.id, dto, user.sub);
    return { success: true, data };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const data = await this.ticketsService.getOrThrow(id);
    return { success: true, data };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.ticketsService.update(id, dto, user.sub);
    return { success: true, data };
  }

  @Post(":id/comments")
  async comment(@Param("id") id: string, @Body() dto: CreateTicketCommentDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.ticketsService.addComment(id, dto.content, dto.isInternal ?? true, user.sub);
    return { success: true, data };
  }

  @Post(":id/assign")
  async assign(@Param("id") id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.ticketsService.assign(id, dto.agentId, dto.teamId, user.sub);
    return { success: true, data };
  }

  @Post(":id/resolve")
  async resolve(@Param("id") id: string, @Body() dto: ResolveTicketDto, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.ticketsService.resolve(id, dto.resolution, user.sub);
    return { success: true, data };
  }

  @Post(":id/close")
  async close(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.ticketsService.close(id, user.sub);
    return { success: true, data };
  }

  @Post(":id/reopen")
  async reopen(@Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    const data = await this.ticketsService.reopen(id, user.sub);
    return { success: true, data };
  }
}
