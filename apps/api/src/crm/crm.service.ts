import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorCode, MessageType, SenderType } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ApiException, ForbiddenApiException, NotFoundApiException } from "../common/errors/api.exception";
import type { CrmRequestScope } from "./crm-api-key.guard";
import type { ListCrmConversationsQueryDto } from "./dto/crm.dto";

/**
 * CRM-facing conversation lookup by the handling agent's email. Scoped to the site(s) the
 * presented API key is allowed to read (CrmApiKeyGuard / §4.1-style least privilege).
 */
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversationsByEmail(scope: CrmRequestScope, query: ListCrmConversationsQueryDto) {
    const normalizedEmail = query.email.trim().toLowerCase();
    const siteFilter = await this.resolveSiteFilter(scope, query.site_id);

    const matchingAgents = await this.prisma.user.findMany({
      where: { email: normalizedEmail },
      select: { id: true, name: true },
    });
    const agentIds = matchingAgents.map((agent) => agent.id);

    if (agentIds.length === 0) {
      return [];
    }

    const conversations = await this.prisma.conversation.findMany({
      where: {
        ...(siteFilter ? { siteId: siteFilter } : {}),
        OR: [
          { assignedAgentId: { in: agentIds } },
          { participants: { some: { participantType: "AGENT", userId: { in: agentIds } } } },
        ],
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        handlerType: true,
        priority: true,
        language: true,
        intent: true,
        handoffReason: true,
        assignedAgentId: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        site: { select: { id: true, siteKey: true, name: true } },
        assignedTeam: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        leads: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, name: true, email: true, phone: true, crmLeadId: true, syncStatus: true },
        },
        messages: {
          where: {
            deletedAt: null,
            isInternal: false,
            messageType: { not: MessageType.AI_SUGGESTION },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, senderType: true, messageType: true, content: true, contentSanitized: true, createdAt: true },
        },
        _count: {
          select: {
            messages: {
              where: {
                deletedAt: null,
                isInternal: false,
                messageType: { not: MessageType.AI_SUGGESTION },
              },
            },
          },
        },
      },
    });

    const agentNames = await this.resolveUserNames(
      conversations.flatMap((conversation) => (conversation.assignedAgentId ? [conversation.assignedAgentId] : [])),
    );

    return conversations.map((conversation) => {
      const latestLead = conversation.leads[0] ?? null;
      const latestMessage = conversation.messages[0] ?? null;
      const contact = conversation.customer ?? latestLead;

      return {
        id: conversation.id,
        status: conversation.status,
        handlerType: conversation.handlerType,
        priority: conversation.priority,
        language: conversation.language,
        intent: conversation.intent,
        handoffReason: conversation.handoffReason,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastMessageAt: conversation.lastMessageAt,
        site: conversation.site,
        assignedTeam: conversation.assignedTeam,
        assignedAgent: conversation.assignedAgentId
          ? { id: conversation.assignedAgentId, name: agentNames.get(conversation.assignedAgentId) ?? null }
          : null,
        customer: contact
          ? {
              id: contact.id,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
            }
          : null,
        lead: latestLead,
        messageCount: conversation._count.messages,
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              senderType: latestMessage.senderType,
              messageType: latestMessage.messageType,
              content: latestMessage.contentSanitized ?? latestMessage.content,
              createdAt: latestMessage.createdAt,
            }
          : null,
      };
    });
  }

  async getConversationDetail(scope: CrmRequestScope, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        handlerType: true,
        priority: true,
        channel: true,
        language: true,
        intent: true,
        sentiment: true,
        aiConfidence: true,
        handoffReason: true,
        firstMessageAt: true,
        firstResponseAt: true,
        assignedAt: true,
        resolvedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        assignedAgentId: true,
        site: { select: { id: true, siteKey: true, name: true } },
        assignedTeam: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true, phone: true, accountStatus: true, externalId: true } },
        leads: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            purpose: true,
            productInterest: true,
            crmLeadId: true,
            syncStatus: true,
            syncError: true,
            createdAt: true,
          },
        },
        context: {
          select: {
            pageUrl: true,
            pageTitle: true,
            referrer: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
          },
        },
        summaries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            customerGoal: true,
            importantFacts: true,
            actionsTaken: true,
            openIssues: true,
            sensitiveDataDetected: true,
            trigger: true,
            createdAt: true,
          },
        },
        tickets: {
          orderBy: { createdAt: "desc" },
          select: { id: true, ticketNumber: true, subject: true, status: true, priority: true, createdAt: true },
        },
        messages: {
          where: {
            deletedAt: null,
            isInternal: false,
            messageType: { not: MessageType.AI_SUGGESTION },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderType: true,
            senderId: true,
            messageType: true,
            content: true,
            contentSanitized: true,
            createdAt: true,
            attachments: {
              where: { isInternal: false },
              select: { id: true, fileName: true, mimeType: true, sizeBytes: true, storageKey: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundApiException(ErrorCode.CONVERSATION_NOT_FOUND, "Conversation tidak ditemukan.");
    }

    if (!scope.hasFullAccess) {
      const allowedSiteKeys = scope.credential.siteIds ?? [];
      if (!allowedSiteKeys.includes(conversation.site.siteKey)) {
        throw new ForbiddenApiException("Kredensial ini tidak memiliki akses ke site dari conversation ini.");
      }
    }

    const agentNames = await this.resolveUserNames([
      ...(conversation.assignedAgentId ? [conversation.assignedAgentId] : []),
      ...conversation.messages.flatMap((message) =>
        message.senderType === SenderType.AGENT && message.senderId ? [message.senderId] : [],
      ),
    ]);

    return {
      id: conversation.id,
      status: conversation.status,
      handlerType: conversation.handlerType,
      priority: conversation.priority,
      channel: conversation.channel,
      language: conversation.language,
      intent: conversation.intent,
      sentiment: conversation.sentiment,
      aiConfidence: conversation.aiConfidence,
      handoffReason: conversation.handoffReason,
      firstMessageAt: conversation.firstMessageAt,
      firstResponseAt: conversation.firstResponseAt,
      assignedAt: conversation.assignedAt,
      resolvedAt: conversation.resolvedAt,
      closedAt: conversation.closedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      site: conversation.site,
      assignedTeam: conversation.assignedTeam,
      assignedAgent: conversation.assignedAgentId
        ? { id: conversation.assignedAgentId, name: agentNames.get(conversation.assignedAgentId) ?? null }
        : null,
      customer: conversation.customer,
      leads: conversation.leads,
      context: conversation.context,
      latestSummary: conversation.summaries[0] ?? null,
      tickets: conversation.tickets,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        senderType: message.senderType,
        senderId: message.senderId,
        senderName:
          message.senderType === SenderType.AGENT && message.senderId
            ? agentNames.get(message.senderId) ?? null
            : null,
        messageType: message.messageType,
        content: message.contentSanitized ?? message.content,
        createdAt: message.createdAt,
        attachments: message.attachments,
      })),
    };
  }

  // ── Site scoping ─────────────────────────────────────────────────────

  /** Resolves which internal `Site.id`s a request may read. `undefined` = no restriction (legacy full-access key, no site_id given). */
  private async resolveSiteFilter(scope: CrmRequestScope, siteIdParam?: string): Promise<{ in: string[] } | undefined> {
    if (siteIdParam) {
      if (!scope.hasFullAccess && !(scope.credential.siteIds ?? []).includes(siteIdParam)) {
        throw new ApiException(
          ErrorCode.FORBIDDEN,
          "Kredensial ini tidak memiliki akses ke site_id yang diminta.",
          HttpStatus.FORBIDDEN,
        );
      }
      const site = await this.prisma.site.findUnique({ where: { siteKey: siteIdParam }, select: { id: true } });
      if (!site) {
        throw new ApiException(ErrorCode.VALIDATION_ERROR, `site_id "${siteIdParam}" tidak ditemukan.`, HttpStatus.BAD_REQUEST);
      }
      return { in: [site.id] };
    }

    if (scope.hasFullAccess) return undefined;

    const siteKeys = scope.credential.siteIds ?? [];
    if (siteKeys.length === 0) return undefined;

    const sites = await this.prisma.site.findMany({ where: { siteKey: { in: siteKeys } }, select: { id: true } });
    return { in: sites.map((site) => site.id) };
  }

  private async resolveUserNames(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) return new Map<string, string>();

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true },
    });

    return new Map(users.map((user) => [user.id, user.name]));
  }
}
