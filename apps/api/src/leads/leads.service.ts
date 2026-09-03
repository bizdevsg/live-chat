import { Injectable, HttpStatus } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { ConversationStatus, ErrorCode, HandlerType, QUEUE_NAMES, type CrmSyncJobData } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { CrmProviderFactory } from "./crm-provider.factory";
import { ApiException, NotFoundApiException } from "../common/errors/api.exception";
import type { CreateLeadDto } from "./dto/lead.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly crmProviderFactory: CrmProviderFactory,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeEmitterService,
    @InjectQueue(QUEUE_NAMES.CRM_SYNC) private readonly crmSyncQueue: Queue<CrmSyncJobData>,
  ) {}

  private normalizeLeadInput(dto: CreateLeadDto): CreateLeadDto {
    const normalizePhone = (value: string) => value.trim().replace(/[^\d+]/g, "");

    return {
      ...dto,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: normalizePhone(dto.phone),
      city: dto.city?.trim() || undefined,
      purpose: dto.purpose?.trim() || undefined,
      productInterest: dto.productInterest?.trim() || undefined,
    };
  }

  private getResumeState() {
    // A resumed conversation always comes back on the AI. If the visitor wants a human they press
    // "Hubungi Agent" again, and it is routed to whoever is free at that moment (§26).
    return { status: ConversationStatus.AI_ACTIVE, handlerType: HandlerType.AI };
  }

  async createFromWidget(siteId: string, conversationId: string | undefined, dto: CreateLeadDto) {
    const normalized = this.normalizeLeadInput(dto);

    if (!normalized.consentGiven) {
      throw new ApiException(ErrorCode.VALIDATION_ERROR, "Persetujuan privacy policy diperlukan sebelum data dikirim.", HttpStatus.BAD_REQUEST);
    }
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId } });
    const conversation = conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            organizationId: true,
            siteId: true,
            visitorId: true,
            assignedAgentId: true,
            assignedTeamId: true,
            customerId: true,
            status: true,
            handlerType: true,
            firstMessageAt: true,
          },
        })
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const existingCustomer =
        conversation?.customerId
          ? await tx.customer.findUnique({ where: { id: conversation.customerId } })
          : await tx.customer.findFirst({
              where: {
                siteId,
                OR: [{ email: normalized.email }, { phone: normalized.phone }],
              },
              orderBy: { updatedAt: "desc" },
            });

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: normalized.name,
              email: normalized.email,
              phone: normalized.phone,
            },
          })
        : await tx.customer.create({
            data: {
              siteId,
              name: normalized.name,
              email: normalized.email,
              phone: normalized.phone,
            },
          });

      const resumableConversation = await tx.conversation.findFirst({
        where: {
          siteId,
          id: conversation?.id ? { not: conversation.id } : undefined,
          status: { notIn: [ConversationStatus.CLOSED, ConversationStatus.SPAM, ConversationStatus.BLOCKED] },
          OR: [
            { customerId: customer.id },
            { customer: { email: normalized.email } },
            { leads: { some: { email: normalized.email } } },
          ],
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          assignedAgentId: true,
          assignedTeamId: true,
          status: true,
        },
      });

      let targetConversationId = conversation?.id;

      if (resumableConversation && conversation?.visitorId) {
        targetConversationId = resumableConversation.id;
        const resumeState =
          resumableConversation.status === ConversationStatus.RESOLVED ? this.getResumeState() : null;

        await tx.conversation.update({
          where: { id: resumableConversation.id },
          data: {
            visitorId: conversation.visitorId,
            customerId: customer.id,
            ...(resumeState
              ? {
                  assignedAgentId: null,
                  status: resumeState.status,
                  handlerType: resumeState.handlerType,
                  assignedAt: null,
                  resolvedAt: null,
                  closedAt: null,
                }
              : {}),
          },
        });

        if (!conversation.firstMessageAt) {
          await tx.conversation.delete({ where: { id: conversation.id } });
        }
      } else if (conversation && conversation.customerId !== customer.id) {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { customerId: customer.id },
        });
      }

      const createdLead = await tx.lead.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          conversationId: targetConversationId,
          customerId: customer.id,
          name: normalized.name,
          email: normalized.email,
          phone: normalized.phone,
          city: normalized.city,
          purpose: normalized.purpose,
          productInterest: normalized.productInterest,
          consentGiven: normalized.consentGiven,
          source: "WIDGET",
          syncStatus: "PENDING",
        },
      });

      await tx.leadEvent.create({ data: { leadId: createdLead.id, type: "lead.created" } });
      return {
        lead: createdLead,
        conversationId: targetConversationId,
        resumedConversation: targetConversationId !== conversation?.id,
      };
    });

    const { lead, conversationId: finalConversationId, resumedConversation } = result;
    await this.crmSyncQueue.add("sync", { leadId: lead.id }, { attempts: 5, backoff: { type: "exponential", delay: 5000 } });
    if (finalConversationId) {
      const notificationConversation = await this.prisma.conversation.findUnique({
        where: { id: finalConversationId },
        select: { id: true, organizationId: true, siteId: true, assignedTeamId: true, assignedAgentId: true, handlerType: true, status: true },
      });

      const isStillNewInboxConversation =
        !!notificationConversation &&
        !notificationConversation.assignedAgentId &&
        (notificationConversation.handlerType === HandlerType.NONE || notificationConversation.handlerType === HandlerType.AI);

      this.realtime.toSite(siteId, "queue:updated", { conversationId: finalConversationId, siteId });
      if (notificationConversation?.assignedTeamId && isStillNewInboxConversation) {
        this.realtime.toTeam(notificationConversation.assignedTeamId, "queue:updated", {
          conversationId: notificationConversation.id,
          siteId: notificationConversation.siteId,
        });
        this.notifications.notifyTeam(
          notificationConversation.assignedTeamId,
          "NEW_INBOX_CONVERSATION",
          "Conversation baru masuk",
          "Visitor sudah mengisi data diri dan siap ditangani.",
          { conversationId: notificationConversation.id, siteId: notificationConversation.siteId },
        );
      } else if (notificationConversation && isStillNewInboxConversation) {
        this.notifications.notifyOrganization(
          notificationConversation.organizationId,
          "NEW_INBOX_CONVERSATION",
          "Conversation baru masuk",
          "Visitor sudah mengisi data diri dan siap ditangani.",
          { conversationId: notificationConversation.id, siteId: notificationConversation.siteId },
        );
      }
    }
    return {
      ...lead,
      conversationId: finalConversationId,
      resumedConversation,
      customerName: normalized.name,
      siteName: site.name,
    };
  }

  async list(organizationId: string, siteId?: string) {
    return this.prisma.lead.findMany({ where: { organizationId, siteId: siteId || undefined }, orderBy: { createdAt: "desc" } });
  }

  async getOrThrow(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Lead tidak ditemukan.");
    return lead;
  }

  /** Actual CRM call — invoked by the BullMQ processor and by the manual "retry" action from Admin (§28). */
  async syncLeadToCrm(leadId: string): Promise<void> {
    const lead = await this.getOrThrow(leadId);
    const adapter = await this.crmProviderFactory.getAdapter(lead.organizationId);

    let integration = await this.prisma.integration.findFirst({ where: { organizationId: lead.organizationId, type: "CRM" } });
    if (!integration) {
      integration = await this.prisma.integration.create({
        data: { organizationId: lead.organizationId, type: "CRM", provider: adapter.name, name: "Default CRM" },
      });
    }

    try {
      const result = await adapter.createLead({
        siteId: lead.siteId,
        name: lead.name,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        city: lead.city ?? undefined,
        purpose: lead.purpose ?? undefined,
        productInterest: lead.productInterest ?? undefined,
        consentGiven: lead.consentGiven,
        source: lead.source,
      });
      await this.prisma.$transaction([
        this.prisma.lead.update({ where: { id: leadId }, data: { syncStatus: "SYNCED", crmLeadId: result.crmLeadId, syncError: null } }),
        this.prisma.leadEvent.create({ data: { leadId, type: "lead.synced", payload: { crmLeadId: result.crmLeadId } } }),
        this.prisma.integrationLog.create({
          data: { integrationId: integration.id, action: "createLead", status: "SUCCESS", requestPayload: { leadId }, responsePayload: result as object },
        }),
      ]);
    } catch (error) {
      const message = (error as Error).message;
      await this.prisma.$transaction([
        this.prisma.lead.update({ where: { id: leadId }, data: { syncStatus: "FAILED", syncError: message } }),
        this.prisma.integrationLog.create({
          data: { integrationId: integration.id, action: "createLead", status: "ERROR", requestPayload: { leadId }, errorMessage: message },
        }),
      ]);
      throw error; // let BullMQ retry/backoff handle it
    }
  }

  async manualRetry(leadId: string, actorId: string) {
    await this.auditLog.record({ actorType: "USER", actorId, action: "lead.retry_sync", resourceType: "lead", resourceId: leadId });
    await this.crmSyncQueue.add("sync", { leadId }, { attempts: 3, backoff: { type: "exponential", delay: 2000 } });
    return this.getOrThrow(leadId);
  }
}
