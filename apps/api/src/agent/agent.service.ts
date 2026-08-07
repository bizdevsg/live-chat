import { Injectable } from "@nestjs/common";
import { ConversationStatus, Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
  ) {}

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
        status: { in: [ConversationStatus.QUEUED, ConversationStatus.WAITING_AGENT] },
        ...(teamIds ? { assignedTeamId: { in: teamIds } } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { context: true },
    });
  }

  async myConversations(user: JwtAccessPayload, status?: string) {
    return this.prisma.conversation.findMany({
      where: {
        organizationId: user.organizationId,
        assignedAgentId: user.sub,
        status: status || undefined,
      },
      orderBy: { lastMessageAt: "desc" },
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
  }

  async getConversationDetail(conversationId: string) {
    const [conversation, messages, summaries, aiRuns] = await Promise.all([
      this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { context: true, customer: true, visitor: true } }),
      this.prisma.message.findMany({ where: { conversationId, deletedAt: null }, orderBy: { createdAt: "asc" }, include: { attachments: true } }),
      this.prisma.conversationSummary.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 1 }),
      this.prisma.aiRun.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    return { conversation, messages, summary: summaries[0] ?? null, recentAiRuns: aiRuns };
  }
}
