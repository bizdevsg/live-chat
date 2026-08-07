import { Injectable } from "@nestjs/common";
import { TicketStatus } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";
import type { CreateTicketDto, UpdateTicketDto } from "./dto/ticket.dto";

function generateTicketNumber(): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `SG-${yyyymmdd}-${random}`;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

  async list(organizationId: string, filters: { status?: string; siteId?: string; page?: number; pageSize?: number }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = { organizationId, status: filters.status || undefined, siteId: filters.siteId || undefined };
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getOrThrow(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: { comments: true, events: true } });
    if (!ticket) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Ticket tidak ditemukan.");
    return ticket;
  }

  async create(organizationId: string, siteId: string, dto: CreateTicketDto, createdById: string) {
    let ticketNumber = generateTicketNumber();
    for (let attempt = 0; attempt < 3; attempt++) {
      const exists = await this.prisma.ticket.findUnique({ where: { ticketNumber } });
      if (!exists) break;
      ticketNumber = generateTicketNumber();
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        organizationId,
        siteId,
        customerId: dto.customerId,
        conversationId: dto.conversationId,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority ?? "NORMAL",
        assignedTeamId: dto.assignedTeamId,
        createdById,
      },
    });
    await this.prisma.ticketEvent.create({ data: { ticketId: ticket.id, type: "ticket.created", actorId: createdById } });
    await this.auditLog.record({ organizationId, actorType: "USER", actorId: createdById, action: "ticket.created", resourceType: "ticket", resourceId: ticket.id });
    if (dto.conversationId) this.realtime.toConversation(dto.conversationId, "ticket:created", { ticketId: ticket.id, ticketNumber });
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actorId: string) {
    const before = await this.getOrThrow(id);
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        status: dto.status,
        assignedTeamId: dto.assignedTeamId,
        assignedAgentId: dto.assignedAgentId,
      },
    });
    await this.prisma.ticketEvent.create({ data: { ticketId: id, type: "ticket.updated", actorId, payload: dto as object } });
    await this.auditLog.record({
      actorType: "USER",
      actorId,
      action: "ticket.updated",
      resourceType: "ticket",
      resourceId: id,
      beforeData: { status: before.status, priority: before.priority },
      afterData: { status: ticket.status, priority: ticket.priority },
    });
    return ticket;
  }

  async addComment(id: string, content: string, isInternal: boolean, authorId: string) {
    const comment = await this.prisma.ticketComment.create({ data: { ticketId: id, content, isInternal, authorId } });
    await this.prisma.ticketEvent.create({ data: { ticketId: id, type: "ticket.commented", actorId: authorId } });
    return comment;
  }

  async assign(id: string, agentId: string | undefined, teamId: string | undefined, actorId: string) {
    await this.prisma.ticketAssignment.create({ data: { ticketId: id, agentId, teamId } });
    const ticket = await this.prisma.ticket.update({ where: { id }, data: { assignedAgentId: agentId, assignedTeamId: teamId, status: TicketStatus.IN_PROGRESS } });
    await this.prisma.ticketEvent.create({ data: { ticketId: id, type: "ticket.assigned", actorId, payload: { agentId, teamId } } });
    if (agentId) this.realtime.toAgent(agentId, "ticket:created", { ticketId: id });
    return ticket;
  }

  async resolve(id: string, resolution: string, actorId: string) {
    const ticket = await this.prisma.ticket.update({ where: { id }, data: { status: TicketStatus.RESOLVED, resolution, resolvedAt: new Date() } });
    await this.prisma.ticketEvent.create({ data: { ticketId: id, type: "ticket.resolved", actorId } });
    return ticket;
  }

  async close(id: string, actorId: string) {
    const ticket = await this.prisma.ticket.update({ where: { id }, data: { status: TicketStatus.CLOSED, closedAt: new Date() } });
    await this.prisma.ticketEvent.create({ data: { ticketId: id, type: "ticket.closed", actorId } });
    return ticket;
  }

  async reopen(id: string, actorId: string) {
    const ticket = await this.prisma.ticket.update({ where: { id }, data: { status: TicketStatus.REOPENED, resolvedAt: null, closedAt: null } });
    await this.prisma.ticketEvent.create({ data: { ticketId: id, type: "ticket.reopened", actorId } });
    return ticket;
  }
}
