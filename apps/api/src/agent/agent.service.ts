import { Injectable } from "@nestjs/common";
import { ConversationStatus, Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { PresenceService } from "../common/presence/presence.service";
import { ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
    private readonly presence: PresenceService,
  ) {}

  private conversationListInclude(userId: string) {
    return {
      context: true,
      customer: { select: { id: true, name: true, email: true } },
      leads: { select: { id: true, name: true, email: true, phone: true }, orderBy: { createdAt: "desc" as const }, take: 1 },
      messages: {
        where: { deletedAt: null, isInternal: false },
        select: {
          id: true,
          senderType: true,
          createdAt: true,
          receipts: {
            where: { readerType: "AGENT", readerId: userId },
            select: { id: true, readerType: true, readerId: true, readAt: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    } as const;
  }

  private async myTeamIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.teamMember.findMany({ where: { userId } });
    return memberships.map((m) => m.teamId);
  }

  async queue(user: JwtAccessPayload) {
    const canViewAll = user.permissions.includes(Permission.CONVERSATION_VIEW_ALL);
    const teamIds = canViewAll ? undefined : await this.myTeamIds(user.sub);
    return this.prisma.conversation.findMany({
      where: {
        organizationId: user.organizationId,
        assignedAgentId: null,
        status: { in: [ConversationStatus.AI_ACTIVE, ConversationStatus.QUEUED, ConversationStatus.WAITING_AGENT] },
        OR: [{ firstMessageAt: { not: null } }, { leads: { some: {} } }],
        ...(teamIds ? { assignedTeamId: { in: teamIds } } : {}),
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      include: this.conversationListInclude(user.sub),
    });
  }

  async assertConversationAccess(user: JwtAccessPayload, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.organizationId !== user.organizationId) {
      throw new NotFoundApiException(ErrorCode.CONVERSATION_NOT_FOUND, "Conversation tidak ditemukan.");
    }

    if (user.permissions.includes(Permission.CONVERSATION_VIEW_ALL)) {
      return conversation;
    }

    const teamIds = await this.myTeamIds(user.sub);
    const canAccess =
      conversation.assignedAgentId === user.sub ||
      (!!conversation.assignedTeamId && teamIds.includes(conversation.assignedTeamId));

    if (!canAccess) {
      throw new ForbiddenApiException("Anda tidak memiliki akses ke conversation ini.");
    }

    return conversation;
  }

  async myConversations(user: JwtAccessPayload, status?: string) {
    return this.prisma.conversation.findMany({
      where: {
        organizationId: user.organizationId,
        assignedAgentId: user.sub,
        status: status || undefined,
      },
      orderBy: { lastMessageAt: "desc" },
      include: this.conversationListInclude(user.sub),
    });
  }

  async setStatus(userId: string, organizationId: string, availability: string) {
    await this.prisma.agentProfile.upsert({
      where: { userId },
      update: { availability, lastStatusChangeAt: new Date() },
      create: { userId, availability },
    });
    await this.prisma.agentStatusHistory.create({ data: { userId, status: availability } });
    this.realtime.toOrganizationDashboard(organizationId, "agent:status", { userId, availability });
    // Live chat is org-wide: any agent flipping status can change whether the widget offers
    // live chat or falls back to the offline Ticket Form, so recompute and push it now.
    await this.presence.broadcastPresence(organizationId);
  }

  async getStatus(userId: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId }, select: { availability: true } });
    return { availability: profile?.availability ?? "OFFLINE" };
  }

  async getConversationDetail(user: JwtAccessPayload, conversationId: string) {
    await this.assertConversationAccess(user, conversationId);
    const [conversation, messages, summaries, aiRuns] = await Promise.all([
      this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          context: true,
          customer: true,
          visitor: true,
          leads: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { attachments: true, receipts: true },
      }),
      this.prisma.conversationSummary.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 1 }),
      this.prisma.aiRun.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    return { conversation, messages, summary: summaries[0] ?? null, recentAiRuns: aiRuns };
  }
}
