import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConversationStatus, ErrorCode, HandlerType, MessageType, QUEUE_NAMES, SenderType, type ConversationTimeoutJobData, type HandoffReason } from "@solidchat/shared";
import { Prisma } from "@solidchat/database";
import type { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { SecurityEventService } from "../common/security/security-event.service";
import { NotificationsService } from "../notifications/notifications.service";
import { sanitizePlainText } from "../common/utils/sanitize";
import { scanContent } from "../common/utils/content-guard";
import { ApiException, ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";
import { HttpStatus } from "@nestjs/common";
import {
  AGENT_REPLY_TIMEOUT_JOB_NAME,
  DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS,
  MIN_AGENT_REPLY_TIMEOUT_SECONDS,
  getAgentReplyTimeoutJobId,
} from "./conversation-timeout.constants";

/**
 * Concurrency ceiling assumed when an agent has no profile row yet (the row is normally created on
 * first status change / assignment). Mirrors AgentProfile.maxConcurrentChats' schema default so the
 * fallback never routes more aggressively than a freshly-seeded agent would allow.
 */
const DEFAULT_MAX_CONCURRENT_CHATS = 5;

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
    @InjectQueue(QUEUE_NAMES.CONVERSATION_TIMEOUT)
    private readonly conversationTimeoutQueue: Queue<ConversationTimeoutJobData>,
  ) {}

  private isAwaitingAgentReply(status: string, handlerType: string) {
    return (
      (status === ConversationStatus.QUEUED || status === ConversationStatus.WAITING_AGENT || status === ConversationStatus.AGENT_ACTIVE) &&
      handlerType !== HandlerType.AI
    );
  }

  private normalizeAgentReplyTimeoutSeconds(value?: number | null) {
    if (!value || !Number.isFinite(value)) return DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS;
    return Math.max(MIN_AGENT_REPLY_TIMEOUT_SECONDS, Math.floor(value));
  }

  private async resolveAgentReplyTimeoutSecondsBySiteId(siteId: string) {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: { agentReplyTimeoutSeconds: true },
    });
    return this.normalizeAgentReplyTimeoutSeconds(settings?.agentReplyTimeoutSeconds);
  }

  async resolveAgentReplyTimeoutMs(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { siteId: true },
    });
    if (!conversation) return DEFAULT_AGENT_REPLY_TIMEOUT_SECONDS * 1000;
    const seconds = await this.resolveAgentReplyTimeoutSecondsBySiteId(conversation.siteId);
    return seconds * 1000;
  }

  private async scheduleAgentReplyTimeout(conversationId: string, timeoutStartedAt = new Date()) {
    const delay = await this.resolveAgentReplyTimeoutMs(conversationId);
    const jobId = getAgentReplyTimeoutJobId(conversationId);
    const existing = await this.conversationTimeoutQueue.getJob(jobId);
    await existing?.remove().catch(() => undefined);
    await this.conversationTimeoutQueue.add(
      AGENT_REPLY_TIMEOUT_JOB_NAME,
      { conversationId, timeoutStartedAt: timeoutStartedAt.toISOString() },
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  private async getExistingAgentReplyTimeoutStart(conversationId: string) {
    const existing = await this.conversationTimeoutQueue.getJob(getAgentReplyTimeoutJobId(conversationId));
    const startedAt = existing?.data?.timeoutStartedAt;
    if (!startedAt) return null;
    const parsed = new Date(startedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  async resolveAgentReplyTimeoutStart(conversationId: string) {
    const queueStartedAt = await this.getExistingAgentReplyTimeoutStart(conversationId).catch(() => null);
    if (queueStartedAt) return queueStartedAt;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { assignedAt: true },
    });
    const handoffEvent = await this.prisma.conversationEvent.findFirst({
      where: {
        conversationId,
        type: { in: ["handoff.requested", "conversation.assigned"] },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return handoffEvent?.createdAt ?? conversation?.assignedAt ?? null;
  }

  /**
   * When an unanswered handoff / silent-agent assignment will auto-return to the AI, or null if the
   * conversation is not currently waiting on a human. Drives the agent-side "Kembali ke AI dalam …"
   * countdown, mirroring the visitor-side one in the widget.
   */
  async resolveAgentReplyDeadline(conversationId: string): Promise<Date | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true, handlerType: true },
    });
    if (!conversation || !this.isAwaitingAgentReply(conversation.status, conversation.handlerType)) return null;
    const startedAt = await this.resolveAgentReplyTimeoutStart(conversationId);
    if (!startedAt) return null;
    const timeoutMs = await this.resolveAgentReplyTimeoutMs(conversationId);
    return new Date(startedAt.getTime() + timeoutMs);
  }

  private async cancelAgentReplyTimeout(conversationId: string) {
    const jobId = getAgentReplyTimeoutJobId(conversationId);
    const existing = await this.conversationTimeoutQueue.getJob(jobId);
    await existing?.remove().catch(() => undefined);
  }

  private async refreshAgentReplyTimeout(conversationId: string, timeoutStartedAt = new Date()) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true, handlerType: true },
    });
    if (!conversation || !this.isAwaitingAgentReply(conversation.status, conversation.handlerType)) {
      await this.cancelAgentReplyTimeout(conversationId);
      return;
    }
    const existingStartedAt = await this.getExistingAgentReplyTimeoutStart(conversationId);
    await this.scheduleAgentReplyTimeout(conversationId, existingStartedAt ?? timeoutStartedAt);
  }

  private async safelyRefreshAgentReplyTimeout(conversationId: string, timeoutStartedAt = new Date()) {
    await this.refreshAgentReplyTimeout(conversationId, timeoutStartedAt).catch((error: unknown) => {
      this.logger.warn(
        `Gagal menjadwalkan timeout balasan agent untuk conversation ${conversationId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    });
  }

  private async safelyCancelAgentReplyTimeout(conversationId: string) {
    await this.cancelAgentReplyTimeout(conversationId).catch((error: unknown) => {
      this.logger.warn(
        `Gagal membatalkan timeout balasan agent untuk conversation ${conversationId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    });
  }

  private async postSystemMessage(conversationId: string, content: string) {
    await this.postMessage({
      conversationId,
      senderType: SenderType.SYSTEM,
      content,
      messageType: MessageType.SYSTEM,
    });
  }

  private shouldReleaseAgent(conversation: { assignedAgentId: string | null; status: string; handlerType: string }) {
    return (
      !!conversation.assignedAgentId &&
      conversation.status === ConversationStatus.AGENT_ACTIVE &&
      conversation.handlerType === HandlerType.HUMAN
    );
  }

  private assertAgentCanReply(conversation: { assignedAgentId: string | null; status: string; handlerType: string }, agentId?: string | null) {
    if (
      !agentId ||
      conversation.assignedAgentId !== agentId ||
      conversation.handlerType !== HandlerType.HUMAN ||
      conversation.status === ConversationStatus.RESOLVED ||
      conversation.status === ConversationStatus.CLOSED
    ) {
      throw new ForbiddenApiException("Ambil chat ini dulu sebelum membalas.");
    }
  }

  private assertAgentCanResolve(conversation: { assignedAgentId: string | null; status: string; handlerType: string }, agentId?: string | null) {
    if (
      !agentId ||
      conversation.assignedAgentId !== agentId ||
      conversation.handlerType !== HandlerType.HUMAN ||
      conversation.status !== ConversationStatus.AGENT_ACTIVE
    ) {
      throw new ForbiddenApiException("Chat harus di-takeover agent terlebih dahulu sebelum bisa diselesaikan.");
    }
  }

  private async enrichSenderNames<T extends { senderType: string; senderId: string | null }>(
    messages: T[],
  ): Promise<Array<T & { senderName: string | null }>> {
    const agentIds = Array.from(
      new Set(messages.filter((message) => message.senderType === SenderType.AGENT && message.senderId).map((message) => message.senderId!)),
    );

    if (agentIds.length === 0) {
      return messages.map((message) => ({ ...message, senderName: null }));
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const namesById = new Map(users.map((user) => [user.id, user.name]));

    return messages.map((message) => ({
      ...message,
      senderName: message.senderType === SenderType.AGENT && message.senderId ? namesById.get(message.senderId) ?? null : null,
    }));
  }

  private async enrichSenderName<T extends { senderType: string; senderId: string | null }>(message: T) {
    const [enriched] = await this.enrichSenderNames([message]);
    if (!enriched) return { ...message, senderName: null };
    return enriched;
  }

  private incrementAgentLoad(userId: string) {
    return this.prisma.agentProfile.upsert({
      where: { userId },
      update: { activeChatCount: { increment: 1 } },
      create: { userId, activeChatCount: 1 },
    });
  }

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
    assignedTeamId?: string | null;
    skipRouting?: boolean;
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
    const routedTeam =
      typeof params.assignedTeamId !== "undefined"
        ? params.assignedTeamId
          ? await this.prisma.team.findFirst({ where: { id: params.assignedTeamId, organizationId: params.organizationId, isActive: true } })
          : null
        : params.skipRouting
          ? null
          : await this.resolveRoutingTeam(params.siteId, null);
    const conversation = await this.prisma.conversation.create({
      data: {
        organizationId: params.organizationId,
        siteId: params.siteId,
        visitorId: params.visitorId,
        customerId: params.customerId,
        assignedTeamId: routedTeam?.id,
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
    this.realtime.toSite(conversation.siteId, "queue:updated", { conversationId: conversation.id, siteId: conversation.siteId });
    if (conversation.assignedTeamId) {
      this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId: conversation.id, siteId: conversation.siteId });
      this.notifications.notifyTeam(
        conversation.assignedTeamId,
        "NEW_INBOX_CONVERSATION",
        "Conversation baru masuk",
        "Session visitor baru telah masuk ke inbox tim Anda.",
        { conversationId: conversation.id, siteId: conversation.siteId },
      );
    } else {
      this.notifications.notifyOrganization(
        conversation.organizationId,
        "NEW_INBOX_CONVERSATION",
        "Conversation baru masuk",
        "Session visitor baru telah masuk ke inbox.",
        { conversationId: conversation.id, siteId: conversation.siteId },
      );
    }
    return conversation;
  }

  async getConversationOrThrow(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundApiException(ErrorCode.CONVERSATION_NOT_FOUND, "Conversation tidak ditemukan.");
    return conversation;
  }

  async getHistory(conversationId: string, limit = 30) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return this.enrichSenderNames(messages.reverse());
  }

  async postMessage(input: PostMessageInput) {
    if (input.clientMessageId) {
      const existing = await this.prisma.message.findUnique({
        where: { conversationId_clientMessageId: { conversationId: input.conversationId, clientMessageId: input.clientMessageId } },
      });
      if (existing) return { message: await this.enrichSenderName(existing), sensitiveDataDetected: false, promptInjectionDetected: false }; // idempotent retry
    }

    let conversation: Awaited<ReturnType<ConversationsService["getConversationOrThrow"]>> | undefined;
    if (input.senderType === SenderType.AGENT) {
      conversation = await this.getConversationOrThrow(input.conversationId);
      this.assertAgentCanReply(conversation, input.senderId);
    }

    const isCustomerFacingSender = input.senderType === SenderType.VISITOR || input.senderType === SenderType.CUSTOMER;
    let content = input.content;
    let scan: ReturnType<typeof scanContent> | undefined;

    if (isCustomerFacingSender) {
      content = sanitizePlainText(content);
      scan = scanContent(content);
      if (scan.containsSensitiveData) {
        content = scan.maskedContent;
        conversation ??= await this.getConversationOrThrow(input.conversationId);
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
        if (winner) return { message: await this.enrichSenderName(winner), sensitiveDataDetected: false, promptInjectionDetected: false };
      }
      throw error;
    }

    conversation = await this.prisma.conversation.update({
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

    const enrichedMessage = await this.enrichSenderName(message);
    if (input.senderType === SenderType.AGENT && !(input.isInternal ?? false)) {
      await this.safelyCancelAgentReplyTimeout(input.conversationId);
    }
    this.broadcastMessage(input.conversationId, enrichedMessage);
    if (isCustomerFacingSender) {
      if (conversation.assignedAgentId) {
        this.realtime.toAgent(conversation.assignedAgentId, "conversation:updated", { conversationId: input.conversationId });
        this.notifications.notifyAgent(
          conversation.assignedAgentId,
          "NEW_CUSTOMER_MESSAGE",
          "Pesan customer baru",
          "Ada pesan baru dari visitor pada conversation yang sedang ditangani.",
          { conversationId: input.conversationId, siteId: conversation.siteId },
        );
      } else {
        this.realtime.toSite(conversation.siteId, "queue:updated", { conversationId: input.conversationId, siteId: conversation.siteId });
        if (conversation.assignedTeamId) {
          this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId: input.conversationId, siteId: conversation.siteId });
          this.notifications.notifyTeam(
            conversation.assignedTeamId,
            "NEW_CUSTOMER_MESSAGE",
            "Pesan customer baru",
            "Ada pesan baru dari visitor pada inbox tim Anda.",
            { conversationId: input.conversationId, siteId: conversation.siteId },
          );
        } else {
          this.notifications.notifyOrganization(
            conversation.organizationId,
            "NEW_CUSTOMER_MESSAGE",
            "Pesan customer baru",
            "Ada pesan baru dari visitor pada inbox.",
            { conversationId: input.conversationId, siteId: conversation.siteId },
          );
        }
      }
    }
    return { message: enrichedMessage, sensitiveDataDetected: scan?.containsSensitiveData ?? false, promptInjectionDetected: scan?.promptInjectionDetected ?? false };
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

  async hasPendingVisitorMessageSince(conversationId: string, since: Date) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        isInternal: false,
        createdAt: { gte: since },
        senderType: { in: [SenderType.VISITOR, SenderType.CUSTOMER, SenderType.AI, SenderType.AGENT] },
      },
      orderBy: { createdAt: "asc" },
      select: { senderType: true, createdAt: true },
    });

    const lastVisitorMessage = [...messages].reverse().find((message) => message.senderType === SenderType.VISITOR || message.senderType === SenderType.CUSTOMER);
    if (!lastVisitorMessage) return false;

    return !messages.some(
      (message) =>
        message.createdAt > lastVisitorMessage.createdAt &&
        (message.senderType === SenderType.AI || message.senderType === SenderType.AGENT),
    );
  }

  async requestAgent(conversationId: string, reason: HandoffReason = "CUSTOMER_REQUESTED_HUMAN") {
    const conversation = await this.getConversationOrThrow(conversationId);
    const targetTeam = await this.resolveTeamForHandoff(conversation.siteId, reason, conversation.intent, conversation.assignedTeamId);

    // Record the resolved team + reason, but do NOT queue yet. The visitor only ever sees a
    // "connecting you to an agent" state when an agent can actually take the chat right now.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { handoffReason: reason, assignedTeamId: targetTeam?.id },
    });

    const assigned = targetTeam ? await this.tryAutoAssign(conversationId) : false;

    if (assigned) {
      // assignToAgent already broadcast AGENT_ACTIVE + posted the "agent bergabung" notice.
      await this.logEvent(conversationId, "handoff.requested", "SYSTEM", null, { reason, teamId: targetTeam?.id, outcome: "assigned" });
      this.realtime.toSite(conversation.siteId, "queue:updated", { conversationId });
      return this.getConversationOrThrow(conversationId);
    }

    // No team resolved at all — nothing to queue against, so keep the AI on the conversation
    // rather than stranding the visitor.
    if (!targetTeam) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: ConversationStatus.AI_ACTIVE, handlerType: HandlerType.AI, assignedAgentId: null },
      });
      await this.safelyCancelAgentReplyTimeout(conversationId);
      await this.logEvent(conversationId, "handoff.deferred_no_team", "SYSTEM", null, { reason });
      this.realtime.toConversation(conversationId, "conversation:updated", {
        conversationId,
        status: ConversationStatus.AI_ACTIVE,
        handlerType: HandlerType.AI,
        assignedAgentId: null,
      });
      this.realtime.toSite(conversation.siteId, "queue:updated", { conversationId });
      return this.getConversationOrThrow(conversationId);
    }

    // No agent is free right now. Hold the visitor in the queue with a "connecting you to an agent"
    // state (QUEUED) so whichever agent frees up first can pick the conversation up — plain
    // first-come-first-served. It stays in every dashboard queue for the target team.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.QUEUED, handlerType: HandlerType.NONE, assignedAgentId: null },
    });
    // Start the pickup clock: if no agent Accepts within agentReplyTimeoutSeconds the conversation
    // auto-returns to the AI (autoReturnToAiOnAgentTimeout), and the agent dashboard shows the
    // matching "Kembali ke AI dalam …" countdown.
    await this.safelyRefreshAgentReplyTimeout(conversationId);
    await this.logEvent(conversationId, "handoff.requested", "SYSTEM", null, { reason, teamId: targetTeam.id, outcome: "queued" });
    this.realtime.toConversation(conversationId, "conversation:updated", {
      conversationId,
      status: ConversationStatus.QUEUED,
      handlerType: HandlerType.NONE,
      assignedAgentId: null,
    });
    this.realtime.toTeam(targetTeam.id, "queue:updated", { conversationId, siteId: conversation.siteId });
    this.notifications.notifyTeam(
      targetTeam.id,
      "NEW_WAITING_CONVERSATION",
      "Conversation menunggu agent",
      `Visitor meminta agent (alasan: ${reason}).`,
      { conversationId },
    );
    this.realtime.toSite(conversation.siteId, "queue:updated", { conversationId });

    return this.getConversationOrThrow(conversationId);
  }

  private async resolveTeamForHandoff(siteId: string, reason: HandoffReason, intent: string | null, preferredTeamId?: string | null) {
    const handoffRule = await this.prisma.handoffRule.findFirst({ where: { siteId, reason, isActive: true } });
    const preferredTeam = preferredTeamId
      ? await this.prisma.team.findFirst({ where: { id: preferredTeamId, isActive: true } })
      : null;

    // A team the conversation is already pinned to (e.g. an agent transferred it there before it
    // bounced back to the AI) wins over a NORMAL-priority handoff rule — otherwise the generic
    // "customer requested human" rule silently drags it to another team. Only a HIGH-priority rule
    // (e.g. SERIOUS_COMPLAINT → specialist team) may override that.
    if (preferredTeam && handoffRule?.priority !== "HIGH") return preferredTeam;

    if (handoffRule?.targetTeamId) return this.prisma.team.findUnique({ where: { id: handoffRule.targetTeamId } });
    if (preferredTeam) return preferredTeam;

    const routed = await this.resolveRoutingTeam(siteId, intent);
    if (routed) return routed;

    // Nothing matched — fall back to any active team that has at least one member, so an
    // escalation is never left teamless (which would hide it from every dashboard queue).
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { organizationId: true } });
    if (!site) return null;
    return this.prisma.team.findFirst({
      where: { organizationId: site.organizationId, isActive: true, members: { some: {} } },
      orderBy: [{ routingPriority: "desc" }, { createdAt: "asc" }],
    });
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

  async tryAutoAssign(conversationId: string): Promise<boolean> {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (!conversation.assignedTeamId || conversation.assignedAgentId) return false;

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

    for (const candidate of available) {
      // Claim a concurrency slot atomically: two conversations racing for the same free agent
      // can't both win — the loser falls through to the next candidate (§26).
      const reserved = await this.reserveAgentSlot(candidate.userId, candidate.user.agentProfile!.maxConcurrentChats);
      if (!reserved) continue;
      // Claim the conversation just as atomically — if an agent Accepted it manually a moment ago,
      // give the slot back and stop; it already has a handler.
      const claimed = await this.claimConversation(conversationId, candidate.userId);
      if (!claimed) {
        await this.releaseAgentSlot(candidate.userId);
        return false;
      }
      await this.assignToAgent(conversationId, candidate.userId, "LEAST_ACTIVE", {
        slotAlreadyReserved: true,
        conversationAlreadyClaimed: true,
      });
      return true;
    }
    return false; // everyone is at capacity — the caller keeps the conversation with the AI
  }

  /**
   * Atomically bumps an agent's active-chat count only if they are still below their limit.
   * Returns true when the slot was claimed. Used by every auto-assign / manual-accept path so a
   * single MySQL UPDATE — not a read-then-write — decides who wins a contended agent.
   */
  private async reserveAgentSlot(agentId: string, maxConcurrentChats: number): Promise<boolean> {
    // A user with the handling permission may not have changed their availability yet, so their
    // profile row might not exist. Treat a first manual Accept as profile creation, not as a full
    // workload. Without this row, updateMany matches zero records and incorrectly reports that
    // the agent has reached their chat limit.
    await this.prisma.agentProfile.upsert({
      where: { userId: agentId },
      update: {},
      create: { userId: agentId },
    });

    const reserve = () =>
      this.prisma.agentProfile.updateMany({
        where: { userId: agentId, activeChatCount: { lt: maxConcurrentChats } },
        data: { activeChatCount: { increment: 1 } },
      });

    const res = await reserve();
    if (res.count === 1) return true;

    // The counter is a denormalized value. If an earlier failed/partial operation left it stale,
    // repair it from the source of truth and make one more atomic reservation attempt. The
    // conditional retry still preserves the concurrency ceiling when two agents accept at once.
    const actualActiveChatCount = await this.prisma.conversation.count({
      where: {
        assignedAgentId: agentId,
        status: ConversationStatus.AGENT_ACTIVE,
        handlerType: HandlerType.HUMAN,
      },
    });
    await this.prisma.agentProfile.updateMany({
      where: { userId: agentId, activeChatCount: { gte: maxConcurrentChats } },
      data: { activeChatCount: actualActiveChatCount },
    });

    return (await reserve()).count === 1;
  }

  /** Hands a concurrency slot back when the assignment reserveAgentSlot was for did not go through. */
  private async releaseAgentSlot(agentId: string): Promise<void> {
    await this.prisma.agentProfile.updateMany({
      where: { userId: agentId, activeChatCount: { gt: 0 } },
      data: { activeChatCount: { decrement: 1 } },
    });
  }

  /**
   * Atomically pins a still-unassigned conversation to an agent. The `assignedAgentId: null` guard
   * means that when two agents click Accept on the same conversation at once, exactly one UPDATE
   * matches — the other caller sees count 0 and tells its agent the chat is already taken.
   */
  private async claimConversation(conversationId: string, agentId: string): Promise<boolean> {
    const res = await this.prisma.conversation.updateMany({
      where: { id: conversationId, assignedAgentId: null },
      data: {
        assignedAgentId: agentId,
        handlerType: HandlerType.HUMAN,
        status: ConversationStatus.AGENT_ACTIVE,
        assignedAt: new Date(),
      },
    });
    return res.count === 1;
  }

  async assignToAgent(
    conversationId: string,
    agentId: string,
    strategy = "MANUAL",
    opts: { slotAlreadyReserved?: boolean; conversationAlreadyClaimed?: boolean } = {},
  ) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (
      !opts.conversationAlreadyClaimed &&
      conversation.assignedAgentId === agentId &&
      conversation.handlerType === HandlerType.HUMAN &&
      conversation.status === ConversationStatus.AGENT_ACTIVE
    ) {
      return conversation;
    }

    await this.prisma.$transaction([
      // The racing paths (accept / auto-assign) already flipped assignedAgentId + status
      // atomically via claimConversation, so here we only add the assignment bookkeeping.
      ...(opts.conversationAlreadyClaimed
        ? []
        : [
            ...(conversation.assignedAgentId && conversation.assignedAgentId !== agentId
              ? [this.prisma.agentProfile.update({ where: { userId: conversation.assignedAgentId }, data: { activeChatCount: { decrement: 1 } } })]
              : []),
            this.prisma.conversation.update({
              where: { id: conversationId },
              data: {
                assignedAgentId: agentId,
                handlerType: HandlerType.HUMAN,
                status: ConversationStatus.AGENT_ACTIVE,
                assignedAt: new Date(),
              },
            }),
          ]),
      this.prisma.conversationAssignment.create({
        data: { conversationId, agentId, teamId: conversation.assignedTeamId, strategy },
      }),
      this.prisma.conversationParticipant.create({
        data: { conversationId, participantType: "AGENT", userId: agentId },
      }),
      // Auto-assign / accept already claimed the slot atomically via reserveAgentSlot; only
      // takeover (opts default) still counts the load here — it is allowed to exceed the limit.
      ...(opts.slotAlreadyReserved ? [] : [this.incrementAgentLoad(agentId)]),
    ]);

    await this.logEvent(conversationId, "conversation.assigned", "SYSTEM", agentId, { agentId, strategy });
    const agent = await this.prisma.user.findUnique({ where: { id: agentId }, select: { name: true } });
    await this.postSystemMessage(conversationId, `${agent?.name?.trim() || "Agent"} bergabung ke percakapan.`);
    this.realtime.toAgent(agentId, "conversation:assigned", { conversationId });
    this.realtime.toConversation(conversationId, "conversation:updated", {
      conversationId,
      assignedAgentId: agentId,
      status: ConversationStatus.AGENT_ACTIVE,
      handlerType: HandlerType.HUMAN,
    });
    if (conversation.assignedTeamId) this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId });
    await this.safelyRefreshAgentReplyTimeout(conversationId);
  }

  async accept(conversationId: string, agentId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);

    // Already assigned: to another agent it's a lost race, to this agent it's a harmless retry.
    if (conversation.assignedAgentId) {
      if (conversation.assignedAgentId !== agentId) {
        throw new ForbiddenApiException("Percakapan sudah diambil oleh agent lain.");
      }
      await this.assignToAgent(conversationId, agentId, "MANUAL");
      return this.getConversationOrThrow(conversationId);
    }

    const profile = await this.prisma.agentProfile.findUnique({ where: { userId: agentId }, select: { maxConcurrentChats: true } });
    const reserved = await this.reserveAgentSlot(agentId, profile?.maxConcurrentChats ?? DEFAULT_MAX_CONCURRENT_CHATS);
    if (!reserved) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "Anda sudah menangani jumlah chat maksimum. Selesaikan salah satu sebelum mengambil chat baru.",
        HttpStatus.CONFLICT,
      );
    }

    // Atomic claim — when two agents Accept the same conversation at the same moment, exactly one
    // wins the conditional UPDATE; the other gets its slot back and the "already taken" notice.
    const claimed = await this.claimConversation(conversationId, agentId);
    if (!claimed) {
      await this.releaseAgentSlot(agentId);
      throw new ForbiddenApiException("Percakapan sudah diambil oleh agent lain.");
    }

    await this.assignToAgent(conversationId, agentId, "MANUAL", { slotAlreadyReserved: true, conversationAlreadyClaimed: true });
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
    await this.safelyCancelAgentReplyTimeout(conversationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedAgentId: null, handlerType: HandlerType.AI, status: ConversationStatus.AI_ACTIVE },
    });
    if (this.shouldReleaseAgent(conversation)) {
      await this.prisma.agentProfile
        .update({ where: { userId: conversation.assignedAgentId ?? agentId }, data: { activeChatCount: { decrement: 1 } } })
        .catch(() => undefined);
    }
    await this.logEvent(conversationId, "conversation.returned_to_ai", "USER", agentId, {});
    await this.postSystemMessage(conversationId, "Percakapan dikembalikan ke AI untuk membantu Anda kembali.");
    this.realtime.toConversation(conversationId, "conversation:updated", {
      conversationId,
      assignedAgentId: null,
      handlerType: HandlerType.AI,
      status: ConversationStatus.AI_ACTIVE,
    });
    if (conversation.assignedTeamId) {
      this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId, siteId: conversation.siteId });
    }
    return conversation;
  }

  async autoReturnToAiOnAgentTimeout(conversationId: string, timeoutStartedAt: Date) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        organizationId: true,
        siteId: true,
        assignedAgentId: true,
        assignedTeamId: true,
        status: true,
        handlerType: true,
      },
    });
    if (!conversation) return false;

    if (!this.isAwaitingAgentReply(conversation.status, conversation.handlerType)) {
      await this.safelyCancelAgentReplyTimeout(conversationId);
      return false;
    }

    const agentReply = await this.prisma.message.findFirst({
      where: {
        conversationId,
        deletedAt: null,
        isInternal: false,
        senderType: SenderType.AGENT,
        createdAt: { gt: timeoutStartedAt },
      },
      select: { id: true },
    });
    if (agentReply) {
      await this.safelyCancelAgentReplyTimeout(conversationId);
      return false;
    }

    await this.safelyCancelAgentReplyTimeout(conversationId);
    const timeoutMs = await this.resolveAgentReplyTimeoutMs(conversationId);

    // Flip back to AI atomically. The BullMQ timeout job, the widget's /agent-timeout fallback
    // and the lazy check on the next visitor message can all fire for the same conversation —
    // only the caller that actually changes a row goes on to post the "AI kembali membantu"
    // notice, so it never stacks up.
    const flipped = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        handlerType: { not: HandlerType.AI },
        status: { in: [ConversationStatus.QUEUED, ConversationStatus.WAITING_AGENT, ConversationStatus.AGENT_ACTIVE] },
      },
      data: { assignedAgentId: null, handlerType: HandlerType.AI, status: ConversationStatus.AI_ACTIVE },
    });
    if (flipped.count === 0) return false;

    if (this.shouldReleaseAgent(conversation)) {
      await this.prisma.agentProfile
        .update({ where: { userId: conversation.assignedAgentId! }, data: { activeChatCount: { decrement: 1 } } })
        .catch(() => undefined);
    }
    await this.logEvent(conversationId, "conversation.auto_returned_to_ai", "SYSTEM", null, { timeoutMs });
    await this.postSystemMessage(conversationId, "Agent sedang sibuk, AI kembali membantu percakapan ini.");
    this.realtime.toConversation(conversationId, "conversation:updated", {
      conversationId,
      assignedAgentId: null,
      handlerType: HandlerType.AI,
      status: ConversationStatus.AI_ACTIVE,
    });
    if (conversation.assignedTeamId) {
      this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId, siteId: conversation.siteId });
    }
    return true;
  }

  async autoReturnToAiIfAgentReplyTimedOut(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        assignedAt: true,
        status: true,
        handlerType: true,
      },
    });
    if (!conversation || !this.isAwaitingAgentReply(conversation.status, conversation.handlerType)) {
      return false;
    }

    const timeoutStartedAt = await this.resolveAgentReplyTimeoutStart(conversationId);
    if (!timeoutStartedAt) return false;

    const timeoutMs = await this.resolveAgentReplyTimeoutMs(conversationId);
    if (Date.now() - timeoutStartedAt.getTime() < timeoutMs) {
      return false;
    }

    return this.autoReturnToAiOnAgentTimeout(conversationId, timeoutStartedAt);
  }

  async transfer(conversationId: string, actorId: string, target: { toAgentId?: string; toTeamId?: string }) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.assignedAgentId && !target.toAgentId && this.shouldReleaseAgent(conversation)) {
      await this.prisma.agentProfile.update({ where: { userId: conversation.assignedAgentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    }

    if (target.toAgentId) {
      if (target.toAgentId !== conversation.assignedAgentId) {
        const profile = await this.prisma.agentProfile.findUnique({ where: { userId: target.toAgentId }, select: { maxConcurrentChats: true } });
        const reserved = await this.reserveAgentSlot(target.toAgentId, profile?.maxConcurrentChats ?? DEFAULT_MAX_CONCURRENT_CHATS);
        if (!reserved) {
          throw new ApiException(
            ErrorCode.CONFLICT,
            "Agent tujuan sedang menangani chat lain dan belum bisa menerima transfer.",
            HttpStatus.CONFLICT,
          );
        }
        await this.assignToAgent(conversationId, target.toAgentId, "MANUAL", { slotAlreadyReserved: true });
      } else {
        await this.assignToAgent(conversationId, target.toAgentId, "MANUAL");
      }
    } else if (target.toTeamId) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedTeamId: target.toTeamId, assignedAgentId: null, status: ConversationStatus.QUEUED, handlerType: HandlerType.NONE },
      });
      await this.tryAutoAssign(conversationId);
      this.realtime.toTeam(target.toTeamId, "queue:updated", { conversationId });
      await this.safelyRefreshAgentReplyTimeout(conversationId);
    }

    await this.logEvent(conversationId, "conversation.transferred", "USER", actorId, target);
    return this.getConversationOrThrow(conversationId);
  }

  async resolve(conversationId: string, actorId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    this.assertAgentCanResolve(conversation, actorId);
    await this.safelyCancelAgentReplyTimeout(conversationId);
    if (this.shouldReleaseAgent(conversation)) {
      const assignedAgentId = conversation.assignedAgentId!;
      await this.prisma.agentProfile.update({ where: { userId: assignedAgentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.RESOLVED, resolvedAt: new Date() },
    });
    await this.logEvent(conversationId, "conversation.resolved", "USER", actorId, {});
    this.realtime.toConversation(conversationId, "conversation:updated", { conversationId, status: ConversationStatus.RESOLVED });
    return updated;
  }

  async reopen(conversationId: string, actorId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    if (conversation.status === ConversationStatus.CLOSED) {
      throw new ApiException(ErrorCode.VALIDATION_ERROR, "Chat yang sudah di-close tidak bisa di-reopen.", HttpStatus.BAD_REQUEST);
    }
    const nextStatus = conversation.assignedAgentId
      ? ConversationStatus.AGENT_ACTIVE
      : conversation.assignedTeamId
        ? ConversationStatus.QUEUED
        : ConversationStatus.AI_ACTIVE;
    const nextHandlerType = conversation.assignedAgentId ? HandlerType.HUMAN : conversation.assignedTeamId ? HandlerType.NONE : HandlerType.AI;
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: nextStatus, handlerType: nextHandlerType, resolvedAt: null, closedAt: null },
    });
    if (conversation.assignedAgentId) {
      await this.incrementAgentLoad(conversation.assignedAgentId).catch(() => undefined);
    } else if (conversation.assignedTeamId) {
      await this.tryAutoAssign(conversationId);
      this.realtime.toTeam(conversation.assignedTeamId, "queue:updated", { conversationId, siteId: conversation.siteId });
    }
    await this.logEvent(conversationId, "conversation.reopened", "USER", actorId, {});
    await this.safelyRefreshAgentReplyTimeout(conversationId);
    return updated;
  }

  async close(conversationId: string, actorType: "VISITOR" | "SYSTEM" | "USER" = "VISITOR", actorId?: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.safelyCancelAgentReplyTimeout(conversationId);
    if (this.shouldReleaseAgent(conversation)) {
      const assignedAgentId = conversation.assignedAgentId!;
      await this.prisma.agentProfile.update({ where: { userId: assignedAgentId }, data: { activeChatCount: { decrement: 1 } } }).catch(() => undefined);
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED, closedAt: new Date() },
    });
    await this.logEvent(conversationId, "conversation.closed", actorType, actorId ?? null, {});
    this.realtime.toConversation(conversationId, "conversation:updated", { conversationId, status: ConversationStatus.CLOSED });
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
