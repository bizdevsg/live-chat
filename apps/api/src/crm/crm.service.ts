import { Injectable } from "@nestjs/common";
import { MessageType, SenderType, ErrorCode } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException } from "../common/errors/api.exception";

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversationsByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
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

  async getConversationDetail(conversationId: string) {
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

    const agentNames = await this.resolveUserNames(
      [
        ...(conversation.assignedAgentId ? [conversation.assignedAgentId] : []),
        ...conversation.messages.flatMap((message) => (message.senderType === SenderType.AGENT && message.senderId ? [message.senderId] : [])),
      ],
    );

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
