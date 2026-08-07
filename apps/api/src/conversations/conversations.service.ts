import { Injectable, Logger } from "@nestjs/common";
import { ConversationStatus, HandlerType, MessageType, SenderType, type HandoffReason } from "@solidchat/shared";
import { Prisma } from "@solidchat/database";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { SecurityEventService } from "../common/security/security-event.service";
import { NotificationsService } from "../notifications/notifications.service";
import { sanitizePlainText } from "../common/utils/sanitize";
import { scanContent } from "../common/utils/content-guard";
import { ApiException, ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";
import { HttpStatus } from "@nestjs/common";

export interface PostMessageInput {
  conversationId: string;
  senderType: (typeof SenderType)[keyof typeof SenderType];
  senderId?: string | null;
  content: string;
  messageType?: (typeof MessageType)[keyof typeof MessageType];
  isInternal?: boolean;
  clientMessageId?: string;
  aiRunId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
    private readonly auditLog: AuditLogService,
    private readonly securityEvents: SecurityEventService,
    private readonly notifications: NotificationsService,
  ) {}

  async getOrCreateVisitor(siteId: string, visitorKey: string, meta: { ipHash?: string; userAgent?: string }) {
    // Note: Prisma's upsert() on MySQL is NOT atomic — it's a client-side SELECT-then-
    // INSERT/UPDATE, so it races exactly like a manual findUnique+create under real concurrent
    // load (verified: firing 5 parallel /widget/session requests for the same visitor produced
    // 4 unique-constraint failures even after switching to upsert). The only reliable fix is to
    // attempt the write and recover from the constraint violation, same as postMessage() below.
    try {
      return await this.prisma.visitor.upsert({
        where: { siteId_visitorKey: { siteId, visitorKey } },
        update: { lastSeenAt: new Date(), lastIpHash: meta.ipHash, lastUserAgent: meta.userAgent },
        create: { siteId, visitorKey, lastIpHash: meta.ipHash, lastUserAgent: meta.userAgent },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await this.prisma.visitor.findUnique({ where: { siteId_visitorKey: { siteId, visitorKey } } });
        if (winner) return winner;
      }
      throw error;
    }
  }

  async getActiveConversation(siteId: string, visitorId: string) {
    return this.prisma.conversation.findFirst({
      where: {
        siteId,
        visitorId,
        status: { notIn: [ConversationStatus.CLOSED, ConversationStatus.RESOLVED, ConversationStatus.SPAM, ConversationStatus.BLOCKED] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createConversation(params: {
    organizationId: string;
    siteId: string;
    visitorId?: string;
    customerId?: string;
    context?: {
      pageUrl?: string;
      pageTitle?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      language?: string;
    };
  }) {
    const conversation = await this.prisma.conversation.create({
      data: {
        organizationId: params.organizationId,
        siteId: params.siteId,
        visitorId: params.visitorId,
        customerId: params.customerId,
        status: ConversationStatus.AI_ACTIVE,
        handlerType: HandlerType.AI,
        language: params.context?.language ?? "id",
      },
    });

    if (params.context) {
      await this.prisma.conversationContext.create({
        data: {
          conversationId: conversation.id,
          pageUrl: params.context.pageUrl,
          pageTitle: params.context.pageTitle,
          referrer: params.context.referrer,
          utmSource: params.context.utmSource,
          utmMedium: params.context.utmMedium,
          utmCampaign: params.context.utmCampaign,
        },
      });
    }

    await this.logEvent(conversation.id, "conversation.created", "SYSTEM", null, {});
    return conversation;
  }

  async getConversationOrThrow(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundApiException(ErrorCode.CONVERSATION_NOT_FOUND, "Conversation tidak ditemukan.");
    return conversation;
  }

  async getHistory(conversationId: string, limit = 30) {
    return this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
    }).then((rows) => rows.reverse());
  }

  async postMessage(input: PostMessageInput) {
    if (input.clientMessageId) {
      const existing = await this.prisma.message.findUnique({
        where: { conversationId_clientMessageId: { conversationId: input.conversationId, clientMessageId: input.clientMessageId } },
      });
      if (existing) return { message: existing, sensitiveDataDetected: false, promptInjectionDetected: false }; // idempotent retry
    }

    const isCustomerFacingSender = input.senderType === SenderType.VISITOR || input.senderType === SenderType.CUSTOMER;
    let content = input.content;
    let scan: ReturnType<typeof scanContent> | undefined;

    if (isCustomerFacingSender) {
      content = sanitizePlainText(content);
      scan = scanContent(content);
      if (scan.containsSensitiveData) {
        content = scan.maskedContent;
        const conversation = await this.getConversationOrThrow(input.conversationId);
        await this.securityEvents.record({
          organizationId: conversation.organizationId,
          type: "SENSITIVE_DATA_DETECTED",
          severity: "MEDIUM",
          details: { conversationId: input.conversationId },
        });
      }
    }

    let message;
    try {
      message = await this.prisma.message.create({
        data: {
          conversationId: input.conversationId,
          senderType: input.senderType,
          senderId: input.senderId ?? null,
          messageType: input.messageType ?? MessageType.TEXT,
          content,
          contentSanitized: content,
          isInternal: input.isInternal ?? false,
          clientMessageId: input.clientMessageId,
          aiRunId: input.aiRunId,
          metadata: input.metadata as object | undefined,
        },
      });
    } catch (error) {
      // Two near-simultaneous requests with the same clientMessageId (e.g. a network retry
      // firing while the first attempt is still in flight) both pass the findUnique check
      // above before either commits. The second create() then hits the unique constraint
      // instead of the earlier idempotent-return path — treat that race the same way: return
      // whichever message actually got persisted, rather than a 500.
      if (
        input.clientMessageId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await this.prisma.message.findUnique({
          where: { conversationId_clientMessageId: { conversationId: input.conversationId, clientMessageId: input.clientMessageId } },
        });
        if (winner) return { message: winner, sensitiveDataDetected: false, promptInjectionDetected: false };
      }
      throw error;
    }

    const conversation = await this.prisma.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    });
    // Backfill firstMessageAt separately (Prisma has no atomic COALESCE update).
    if (!conversation.firstMessageAt) {
      await this.prisma.conversation.update({ where: { id: input.conversationId }, data: { firstMessageAt: message.createdAt } });
    }
    if ((input.senderType === SenderType.AGENT || input.senderType === SenderType.AI) && !conversation.firstResponseAt) {
      await this.prisma.conversation.update({ where: { id: input.conversationId }, data: { firstResponseAt: message.createdAt } });
    }

    this.broadcastMessage(input.conversationId, message);
    return { message, sensitiveDataDetected: scan?.containsSensitiveData ?? false, promptInjectionDetected: scan?.promptInjectionDetected ?? false };
  }

  /** Internal notes and AI suggestions must never reach the visitor-facing widget socket namespace (§14). */
  private broadcastMessage(conversationId: string, message: { isInternal: boolean; messageType: string }) {
    if (message.isInternal || message.messageType === MessageType.AI_SUGGESTION) {
      this.realtime.toConversation(conversationId, "message:created", { conversationId, internalOnly: true, message });
      return;
    }
    this.realtime.toConversation(conversationId, "message:created", { conversationId, message });
  }

  async logEvent(conversationId: string, type: string, actorType: string, actorId: string | null, payload: Record<string, unknown>) {
    await this.prisma.conversationEvent.create({ data: { conversationId, type, actorType, actorId, payload: payload as object } });
    this.realtime.toConversation(conversationId, "conversation:updated", { conversationId, event: type });
  }

  async requestAgent(conversationId: string, reason: HandoffReason = "CUSTOMER_REQUESTED_HUMAN") {
    const conversation = await this.getConversationOrThrow(conversationId);
    const targetTeam = await this.resolveTeamForHandoff(conversation.siteId, reason, conversation.intent);

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.QUEUED,
        handlerType: HandlerType.NONE,
        handoffReason: reason,
        assignedTeamId: targetTeam?.id,
      },
    });

    await this.logEvent(conversationId, "handoff.requested", "SYSTEM", null, { reason, teamId: targetTeam?.id });
    await this.tryAutoAssign(updated.id);

    if (targetTeam) {
      this.realtime.toTeam(targetTeam.id, "queue:updated", { conversationId, siteId: conversation.siteId });
      this.notifications.notifyTeam(
        targetTeam.id,
        "NEW_WAITING_CONVERSATION",
        "Conversation baru menunggu",
        `Conversation memerlukan agent (alasan: ${reason}).`,
        { conversationId },
      );
    }
    this.realtime.toSite(conversation.siteId, "queue:updated", { conversationId });

    return this.getConversationOrThrow(conversationId);
  }

  private async resolveTeamForHandoff(siteId: string, reason: HandoffReason, intent: string | null) {
    const handoffRule = await this.prisma.handoffRule.findFirst({ where: { siteId, reason, isActive: true } });
    if (handoffRule?.targetTeamId) return this.prisma.team.findUnique({ where: { id: handoffRule.targetTeamId } });
    return this.resolveRoutingTeam(siteId, intent);
  }

  private async resolveRoutingTeam(siteId: string, intent: string | null) {
    const rules = await this.prisma.routingRule.findMany({
      where: { siteId, isActive: true },
      orderBy: { priority: "desc" },
    });
    for (const rule of rules) {
      const conditions = (rule.conditions as { intent?: string }) ?? {};
      if (!conditions.intent || conditions.intent === intent) {
        if (rule.targetTeamId) return this.prisma.team.findUnique({ where: { id: rule.targetTeamId } });
      }
    }
    return null;
  }

  async tryAutoAssign(conversationId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (!conversation.assignedTeamId || conversation.assignedAgentId) return;

    const candidates = await this.prisma.teamMember.findMany({
      where: {
        teamId: conversation.assignedTeamId,
        user: { agentProfile: { availability: "ONLINE" } },
      },
      include: { user: { include: { agentProfile: true } } },
    });

    const available = candidates
      .filter((c) => c.user.agentProfile && c.user.agentProfile.activeChatCount < c.user.agentProfile.maxConcurrentChats)
      .sort((a, b) => (a.user.agentProfile?.activeChatCount ?? 0) - (b.user.agentProfile?.activeChatCount ?? 0));

    const chosen = available[0];
    if (!chosen) return; // stays in queue — no fake ETA is fabricated (§26)

    await this.assignToAgent(conversationId, chosen.userId, "LEAST_ACTIVE");
  }

  async assignToAgent(conversationId: string, agentId: string, strategy = "MANUAL") {
    const conversation = await this.getConversationOrThrow(conversationId);

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          assignedAgentId: agentId,
          handlerType: HandlerType.HUMAN,
          status: ConversationStatus.AGENT_ACTIVE,
          assignedAt: new Date(),
        },
      }),
      this.prisma.conversationAssignment.create({
        data: { conversationId, agentId, teamId: conversation.assignedTeamId, strategy },
      }),
      this.prisma.conversationParticipant.create({
        data: { conversationId, participantType: "AGENT", userId: agentId },
      }),
      this.prisma.agentProfile.update({ where: { userId: agentId }, data: { activeChatCount: { increment: 1 } } }),
    ]);

    await this.logEvent(conversationId, "conversation.assigned", "SYSTEM", agentId, { agentId, strategy });
    this.realtime.toAgent(agentId, "conversation:assigned", { conversationId });
    this.realtime.toConversation(conversationId, "conversation:updated", { conversationId, status: ConversationStatus.AGENT_ACTIVE });
    if (conversation.assignedTeamId) this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId });
  }

  async accept(conversationId: string, agentId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.assignedAgentId && conversation.assignedAgentId !== agentId) {
      throw new ForbiddenApiException("Conversation sudah ditangani agent lain.");
    }
    await this.assignToAgent(conversationId, agentId, "MANUAL");
    return this.getConversationOrThrow(conversationId);
  }

  async takeover(conversationId: string, agentId: string) {
    const before = await this.getConversationOrThrow(conversationId);
    await this.assignToAgent(conversationId, agentId, "MANUAL");
    await this.auditLog.record({
      organizationId: before.organizationId,
      actorType: "USER",
      actorId: agentId,
      action: "conversation.takeover",
      resourceType: "conversation",
      resourceId: conversationId,
      beforeData: { handlerType: before.handlerType },
      afterData: { handlerType: HandlerType.HUMAN },
    });
    return this.getConversationOrThrow(conversationId);
  }

  async returnToAi(conversationId: string, agentId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { handlerType: HandlerType.AI, status: ConversationStatus.AI_ACTIVE },
    });
    await this.prisma.agentProfile.update({ where: { userId: agentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    await this.logEvent(conversationId, "conversation.returned_to_ai", "USER", agentId, {});
    this.realtime.toConversation(conversationId, "conversation:updated", { conversationId, handlerType: HandlerType.AI });
    return conversation;
  }

  async transfer(conversationId: string, actorId: string, target: { toAgentId?: string; toTeamId?: string }) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.assignedAgentId) {
      await this.prisma.agentProfile.update({ where: { userId: conversation.assignedAgentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    }

    if (target.toAgentId) {
      await this.assignToAgent(conversationId, target.toAgentId, "MANUAL");
    } else if (target.toTeamId) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedTeamId: target.toTeamId, assignedAgentId: null, status: ConversationStatus.QUEUED, handlerType: HandlerType.NONE },
      });
      await this.tryAutoAssign(conversationId);
      this.realtime.toTeam(target.toTeamId, "queue:updated", { conversationId });
    }

    await this.logEvent(conversationId, "conversation.transferred", "USER", actorId, target);
    return this.getConversationOrThrow(conversationId);
  }

  async resolve(conversationId: string, actorId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.assignedAgentId) {
      await this.prisma.agentProfile.update({ where: { userId: conversation.assignedAgentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.RESOLVED, resolvedAt: new Date() },
    });
    await this.logEvent(conversationId, "conversation.resolved", "USER", actorId, {});
    return updated;
  }

  async reopen(conversationId: string, actorId: string) {
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.AGENT_ACTIVE, resolvedAt: null, closedAt: null },
    });
    await this.logEvent(conversationId, "conversation.reopened", "USER", actorId, {});
    return updated;
  }

  async close(conversationId: string, actorType: "VISITOR" | "SYSTEM" | "USER" = "VISITOR", actorId?: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.assignedAgentId) {
      await this.prisma.agentProfile.update({ where: { userId: conversation.assignedAgentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED, closedAt: new Date() },
    });
    await this.logEvent(conversationId, "conversation.closed", actorType, actorId ?? null, {});
    return updated;
  }

  async submitFeedback(conversationId: string, score: number, comment?: string) {
    if (score < 1 || score > 5) {
      throw new ApiException(ErrorCode.VALIDATION_ERROR, "Skor rating harus antara 1-5.", HttpStatus.BAD_REQUEST);
    }
    await this.prisma.customerFeedback.create({ data: { conversationId, score, comment } });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { ratingScore: score, ratingComment: comment } });
    await this.logEvent(conversationId, "conversation.feedback_submitted", "VISITOR", null, { score });
  }

  async markRead(messageId: string, readerType: string, readerId?: string | null) {
    return this.prisma.messageReceipt.upsert({
      where: { messageId_readerType_readerId: { messageId, readerType, readerId: (readerId ?? null) as string } },
      update: { readAt: new Date() },
      create: { messageId, readerType, readerId },
    });
  }

  async addInternalNote(conversationId: string, agentId: string, content: string) {
    return this.postMessage({
      conversationId,
      senderType: SenderType.AGENT,
      senderId: agentId,
      content,
      messageType: MessageType.INTERNAL_NOTE,
      isInternal: true,
    });
  }
}
