import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ConversationStatus, HandlerType, QUEUE_NAMES } from "@solidchat/shared";
import { PrismaService } from "../prisma.service";

/** Retention housekeeping (§31, §37): expired sessions/reset tokens are pruned, not audit/financial data. */
@Processor(QUEUE_NAMES.CLEANUP)
export class CleanupProcessor extends WorkerHost {
  private static readonly AUTO_CLOSE_INACTIVITY_HOURS = 1;
  private static readonly FINAL_CONVERSATION_STATUSES = [
    ConversationStatus.RESOLVED,
    ConversationStatus.CLOSED,
    ConversationStatus.SPAM,
    ConversationStatus.BLOCKED,
  ] as const;

  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async autoCloseInactiveConversations(now: Date) {
    const inactivityCutoff = new Date(now.getTime() - CleanupProcessor.AUTO_CLOSE_INACTIVITY_HOURS * 60 * 60 * 1000);
    const staleConversations = await this.prisma.conversation.findMany({
      where: {
        status: { notIn: [...CleanupProcessor.FINAL_CONVERSATION_STATUSES] },
        OR: [{ lastMessageAt: { lt: inactivityCutoff } }, { lastMessageAt: null, createdAt: { lt: inactivityCutoff } }],
      },
      select: { id: true },
    });

    if (staleConversations.length === 0) {
      return 0;
    }

    const staleConversationIds = staleConversations.map((conversation) => conversation.id);

    return this.prisma.$transaction(async (tx) => {
      const conversationsToClose = await tx.conversation.findMany({
        where: {
          id: { in: staleConversationIds },
          status: { notIn: [...CleanupProcessor.FINAL_CONVERSATION_STATUSES] },
        },
        select: {
          id: true,
          assignedAgentId: true,
          status: true,
          handlerType: true,
        },
      });

      if (conversationsToClose.length === 0) {
        return 0;
      }

      const conversationIdsToClose = conversationsToClose.map((conversation) => conversation.id);
      await tx.conversation.updateMany({
        where: { id: { in: conversationIdsToClose } },
        data: { status: ConversationStatus.CLOSED, closedAt: now },
      });

      await tx.conversationEvent.createMany({
        data: conversationIdsToClose.map((conversationId) => ({
          conversationId,
          type: "conversation.auto_closed_inactive",
          actorType: "SYSTEM",
          actorId: null,
          payload: { inactivityHours: CleanupProcessor.AUTO_CLOSE_INACTIVITY_HOURS },
        })),
      });

      const agentReleaseCounts = conversationsToClose.reduce<Record<string, number>>((counts, conversation) => {
        if (
          !conversation.assignedAgentId ||
          conversation.status !== ConversationStatus.AGENT_ACTIVE ||
          conversation.handlerType !== HandlerType.HUMAN
        ) {
          return counts;
        }

        counts[conversation.assignedAgentId] = (counts[conversation.assignedAgentId] ?? 0) + 1;
        return counts;
      }, {});

      await Promise.all(
        Object.entries(agentReleaseCounts).map(([agentId, count]) =>
          tx.agentProfile.updateMany({
            where: { userId: agentId },
            data: { activeChatCount: { decrement: count } },
          }),
        ),
      );

      return conversationIdsToClose.length;
    });
  }

  async process(): Promise<void> {
    const now = new Date();
    const rateLimitCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [sessions, resetTokens, invitations, rateLimitEvents, autoClosedConversations] = await Promise.all([
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.invitation.deleteMany({ where: { expiresAt: { lt: now }, acceptedAt: null } }),
      this.prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: rateLimitCutoff } } }),
      this.autoCloseInactiveConversations(now),
    ]);

    this.logger.log(
      `Cleanup: removed ${sessions.count} expired sessions, ${resetTokens.count} reset tokens, ${invitations.count} stale invitations, ${rateLimitEvents.count} rate-limit events, auto-closed ${autoClosedConversations} inactive conversations.`,
    );
  }
}
