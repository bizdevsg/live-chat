import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@solidchat/database";
import { SenderType } from "@solidchat/shared";
import { ClaraWebhookService } from "../clara-webhook/clara-webhook.service";
import { sanitizePlainText } from "../common/utils/sanitize";
import type { ExtensionIdentity } from "../auth/extension-token/extension-token.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ExtensionChannel,
  ExtensionSnapshotDto,
} from "./dto/extension-snapshot.dto";

@Injectable()
export class ExtensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claraWebhooks: ClaraWebhookService,
  ) {}

  async upsertSnapshot(
    channel: ExtensionChannel,
    dto: ExtensionSnapshotDto,
    identity: ExtensionIdentity,
  ) {
    const site = await this.prisma.site.findFirst({
      where: {
        siteKey: dto.siteId,
        organizationId: identity.organizationId,
        isActive: true,
      },
      select: { id: true, organizationId: true },
    });
    if (!site) throw new NotFoundException("Site extension tidak ditemukan.");

    const conversationId = this.stableId(
      "extconv",
      site.id,
      channel,
      dto.conversationId,
    );
    const customerExternalId = `extension:${channel}:${dto.conversationId}`;
    const customerName =
      sanitizePlainText(dto.customerName ?? dto.title ?? "Customer").slice(
        0,
        255,
      ) || "Customer";

    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: {
          siteId_externalId: {
            siteId: site.id,
            externalId: customerExternalId,
          },
        },
        update: {
          name: customerName,
          ...(dto.customerEmail
            ? { email: dto.customerEmail.toLowerCase() }
            : {}),
          ...(dto.lead?.phone ? { phone: dto.lead.phone } : {}),
        },
        create: {
          siteId: site.id,
          externalId: customerExternalId,
          name: customerName,
          email: dto.customerEmail?.toLowerCase(),
          phone: dto.lead?.phone,
        },
      });

      const conversation = await tx.conversation.upsert({
        where: { id: conversationId },
        update: {
          customerId: customer.id,
          assignedAgentId: identity.sub,
          channel: channel.toUpperCase(),
          lastMessageAt: new Date(
            dto.messages[dto.messages.length - 1]!.sentAt,
          ),
        },
        create: {
          id: conversationId,
          organizationId: site.organizationId,
          siteId: site.id,
          customerId: customer.id,
          assignedAgentId: identity.sub,
          status: "AGENT_ACTIVE",
          handlerType: "HUMAN",
          channel: channel.toUpperCase(),
          firstMessageAt: new Date(dto.messages[0]!.sentAt),
          lastMessageAt: new Date(
            dto.messages[dto.messages.length - 1]!.sentAt,
          ),
          assignedAt: new Date(),
        },
      });

      if (dto.lead) {
        const lead = await tx.lead.findFirst({
          where: { conversationId },
          select: { id: true },
        });
        const leadData = {
          name: customerName,
          email: dto.customerEmail?.toLowerCase(),
          phone: dto.lead.phone,
          city: dto.lead.city,
          purpose: dto.lead.purpose,
          productInterest: dto.lead.productInterest,
          consentGiven: dto.lead.consentGiven ?? false,
          source: channel.toUpperCase(),
        };
        if (lead) {
          await tx.lead.update({ where: { id: lead.id }, data: leadData });
        } else {
          await tx.lead.create({
            data: {
              ...leadData,
              organizationId: site.organizationId,
              siteId: site.id,
              conversationId,
              customerId: customer.id,
              syncStatus: "PENDING",
            },
          });
        }
      }

      const messageData: Prisma.MessageCreateManyInput[] = dto.messages.map(
        (message) => ({
          id: this.stableId(
            "extmsg",
            site.id,
            channel,
            dto.conversationId,
            message.id,
          ),
          conversationId,
          senderType:
            message.senderType === "sales"
              ? SenderType.AGENT
              : message.senderType === "ai"
                ? SenderType.AI
                : SenderType.CUSTOMER,
          senderId: message.senderType === "sales" ? identity.sub : null,
          messageType: "TEXT",
          content: sanitizePlainText(message.text),
          contentSanitized: sanitizePlainText(message.text),
          isInternal: false,
          createdAt: new Date(message.sentAt),
          updatedAt: new Date(message.sentAt),
        }),
      );
      const inserted = await tx.message.createMany({
        data: messageData,
        skipDuplicates: true,
      });
      return { conversation, insertedMessages: inserted.count };
    });

    await this.claraWebhooks.scheduleConversation(conversationId);
    return {
      conversationId: result.conversation.id,
      insertedMessages: result.insertedMessages,
    };
  }

  private stableId(prefix: string, ...parts: string[]) {
    return `${prefix}_${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40)}`;
  }
}
