import { Injectable, HttpStatus } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, ErrorCode, type CrmSyncJobData } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../common/audit/audit-log.service";
import { CrmProviderFactory } from "./crm-provider.factory";
import { ApiException, NotFoundApiException } from "../common/errors/api.exception";
import type { CreateLeadDto } from "./dto/lead.dto";

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly crmProviderFactory: CrmProviderFactory,
    @InjectQueue(QUEUE_NAMES.CRM_SYNC) private readonly crmSyncQueue: Queue<CrmSyncJobData>,
  ) {}

  async createFromWidget(siteId: string, conversationId: string | undefined, dto: CreateLeadDto) {
    if (!dto.consentGiven) {
      throw new ApiException(ErrorCode.VALIDATION_ERROR, "Persetujuan privacy policy diperlukan sebelum data dikirim.", HttpStatus.BAD_REQUEST);
    }
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId } });

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: site.organizationId,
        siteId,
        conversationId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        city: dto.city,
        purpose: dto.purpose,
        productInterest: dto.productInterest,
        consentGiven: dto.consentGiven,
        source: "WIDGET",
        syncStatus: "PENDING",
      },
    });
    await this.prisma.leadEvent.create({ data: { leadId: lead.id, type: "lead.created" } });
    await this.crmSyncQueue.add("sync", { leadId: lead.id }, { attempts: 5, backoff: { type: "exponential", delay: 5000 } });
    return lead;
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
