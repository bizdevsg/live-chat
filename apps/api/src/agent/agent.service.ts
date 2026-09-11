import { HttpStatus, Injectable } from "@nestjs/common";
import { AgentAvailability, ConversationStatus, Permission, SystemRole, type JwtAccessPayload } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { PresenceService } from "../common/presence/presence.service";
import { ApiException, ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";
import { CrmProviderFactory } from "../leads/crm-provider.factory";

// Mirrors AgentProfile.maxConcurrentChats' own column default (packages/database/prisma/schema.prisma) — used when an agent has never set a status and so has no AgentProfile row yet.
const DEFAULT_MAX_CONCURRENT_CHATS = 5;

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
    private readonly presence: PresenceService,
    private readonly crmProviderFactory: CrmProviderFactory,
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
        status: { in: [ConversationStatus.AI_ACTIVE, ConversationStatus.QUEUED, ConversationStatus.WAITING_AGENT, ConversationStatus.RESOLVED] },
        OR: [{ firstMessageAt: { not: null } }, { leads: { some: {} } }],
        ...(teamIds ? { assignedTeamId: { in: teamIds } } : {}),
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      include: this.conversationListInclude(user.sub),
    });
  }

  private async getConversationForAccessCheck(user: JwtAccessPayload, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.organizationId !== user.organizationId) {
      throw new NotFoundApiException(ErrorCode.CONVERSATION_NOT_FOUND, "Conversation tidak ditemukan.");
    }
    return conversation;
  }

  /**
   * Whether the agent may currently *act* on this conversation (reply, transfer, resolve, …):
   * org-wide access, the agent it's assigned to right now, or — only while it's still
   * unclaimed — a teammate who could pick it up. Team membership alone stops granting access the
   * moment someone is individually assigned: otherwise any teammate could keep transferring or
   * replying to a conversation long after another agent took it over (or it was transferred away
   * from them), because they'd still share its `assignedTeamId`.
   */
  private async canActOnConversation(user: JwtAccessPayload, conversation: { assignedAgentId: string | null; assignedTeamId: string | null }) {
    if (user.permissions.includes(Permission.CONVERSATION_VIEW_ALL)) return true;
    if (conversation.assignedAgentId === user.sub) return true;
    if (!conversation.assignedAgentId && conversation.assignedTeamId) {
      const teamIds = await this.myTeamIds(user.sub);
      if (teamIds.includes(conversation.assignedTeamId)) return true;
    }
    return false;
  }

  async assertConversationAccess(user: JwtAccessPayload, conversationId: string) {
    const conversation = await this.getConversationForAccessCheck(user, conversationId);
    if (!(await this.canActOnConversation(user, conversation))) {
      throw new ForbiddenApiException("Anda tidak memiliki akses ke conversation ini.");
    }
    return conversation;
  }

  /**
   * Read-only access — for opening a conversation or fetching an attachment out of it. Broader
   * than assertConversationAccess: an agent keeps the ability to look back at a conversation they
   * were ever individually assigned to (assignToAgent records a ConversationParticipant row on
   * accept/auto-assign/transfer/takeover), even after transferring it away. That's what keeps it
   * visible under "My Chats" as history instead of it vanishing the moment someone else takes over.
   */
  async assertConversationViewAccess(user: JwtAccessPayload, conversationId: string) {
    const conversation = await this.getConversationForAccessCheck(user, conversationId);
    if (await this.canActOnConversation(user, conversation)) return conversation;

    const wasParticipant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: user.sub, participantType: "AGENT" },
      select: { id: true },
    });
    if (wasParticipant) return conversation;

    throw new ForbiddenApiException("Anda tidak memiliki akses ke conversation ini.");
  }

  /**
   * "My Chats": conversations the agent currently holds, plus any they were ever individually
   * assigned to — even if since transferred to someone else — so their history stays put instead
   * of disappearing the instant another agent takes over.
   */
  async myConversations(user: JwtAccessPayload, status?: string) {
    return this.prisma.conversation.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [{ assignedAgentId: user.sub }, { participants: { some: { userId: user.sub, participantType: "AGENT" } } }],
        status: status || undefined,
      },
      orderBy: { lastMessageAt: "desc" },
      include: this.conversationListInclude(user.sub),
    });
  }

  /**
   * Conversations abandoned by a visitor before any human agent replied. Keep these separate
   * from the live queue so agents can review missed opportunities without mixing them into work
   * that can still be accepted.
   */
  async closedByVisitorWithoutAgentReply(user: JwtAccessPayload) {
    const canViewAll = user.permissions.includes(Permission.CONVERSATION_VIEW_ALL);
    const teamIds = canViewAll ? undefined : await this.myTeamIds(user.sub);
    return this.prisma.conversation.findMany({
      where: {
        organizationId: user.organizationId,
        status: ConversationStatus.CLOSED,
        events: { some: { type: "conversation.closed", actorType: "VISITOR" } },
        messages: { none: { deletedAt: null, isInternal: false, senderType: "AGENT" } },
        ...(teamIds ? { assignedTeamId: { in: teamIds } } : {}),
      },
      orderBy: [{ closedAt: "desc" }, { lastMessageAt: "desc" }, { createdAt: "desc" }],
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

  /**
   * Called from logout / logout-all: an agent whose session just ended can't still be "Online" or
   * "Busy" in the eyes of transfer pickers or the widget's presence check. Only touches an
   * existing AgentProfile row — never creates one, so logging out a non-agent (admin, auditor, …)
   * is a no-op instead of quietly turning them into an agent.
   */
  async markOfflineOnLogout(userId: string, organizationId: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId }, select: { availability: true } });
    if (!profile || profile.availability === AgentAvailability.OFFLINE) return;
    await this.setStatus(userId, organizationId, AgentAvailability.OFFLINE);
  }

  /**
   * Transfer targets are every individual, active CS Agent in the same organization — not
   * supervisors, admins, or any other role. Queried from User (not AgentProfile): some agents
   * predate the AgentProfile row being created on user creation, or had their role changed to
   * cs_agent afterwards, so they'd otherwise be silently missing from this list even though
   * they're valid transfer targets. A missing profile just means they've never set a status —
   * treated as OFFLINE with the schema's own defaults, same as getStatus() does for one agent.
   */
  async transferCandidates(user: JwtAccessPayload) {
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: user.sub }, // never offer the caller as their own transfer target
        organizationId: user.organizationId,
        isActive: true,
        roles: { some: { role: { slug: SystemRole.CS_AGENT } } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        agentProfile: { select: { availability: true, activeChatCount: true, maxConcurrentChats: true } },
      },
      orderBy: { name: "asc" },
    });

    const shaped = candidates.map((candidate) => ({
      userId: candidate.id,
      availability: candidate.agentProfile?.availability ?? AgentAvailability.OFFLINE,
      activeChatCount: candidate.agentProfile?.activeChatCount ?? 0,
      maxConcurrentChats: candidate.agentProfile?.maxConcurrentChats ?? DEFAULT_MAX_CONCURRENT_CHATS,
      user: { name: candidate.name, email: candidate.email },
    }));

    // Availability isn't sortable in SQL as a plain string (alphabetically BUSY < OFFLINE <
    // ONLINE), so rank it in JS; Array#sort is stable, so name-asc still breaks ties within a
    // group. Anyone whose agentProfile.availability is somehow neither of the three sinks last.
    const rank: Record<string, number> = {
      [AgentAvailability.ONLINE]: 0,
      [AgentAvailability.BUSY]: 1,
      [AgentAvailability.OFFLINE]: 2,
    };
    return shaped.sort((a, b) => (rank[a.availability] ?? 99) - (rank[b.availability] ?? 99));
  }

  async getConversationDetail(user: JwtAccessPayload, conversationId: string) {
    // View access — opening a conversation is how "My Chats" history (one this agent was
    // transferred away from) gets read, so it must not require still holding it.
    await this.assertConversationViewAccess(user, conversationId);
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

  async getAttachment(conversationId: string, attachmentId: string) {
    const attachment = await this.prisma.messageAttachment.findFirst({ where: { id: attachmentId, message: { conversationId } } });
    if (!attachment) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Lampiran tidak ditemukan.");
    return attachment;
  }

  async findCrmCustomerByEmail(user: JwtAccessPayload, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new ApiException(ErrorCode.VALIDATION_ERROR, "Parameter email wajib diisi.");
    }

    const adapter = await this.crmProviderFactory.getRealAdapter(user.organizationId);
    if (!adapter) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "CRM real belum terkonfigurasi. Endpoint ini tidak mendukung mock atau dummy.",
        HttpStatus.CONFLICT,
      );
    }
    const customer = await adapter.findCustomer({ email: normalizedEmail });
    return { email: normalizedEmail, customer };
  }
}
