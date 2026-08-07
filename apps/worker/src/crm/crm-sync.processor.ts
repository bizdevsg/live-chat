import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Job } from "bullmq";
import { MockCrmAdapter, RestCrmAdapter } from "@solidchat/integrations";
import { QUEUE_NAMES, type CrmAdapter, type CrmSyncJobData } from "@solidchat/shared";
import { PrismaService } from "../prisma.service";
import { EncryptionService } from "../encryption.service";

const mockAdapter = new MockCrmAdapter();

/** Consumes leads created via the widget pre-chat form (§28) and pushes them to the CRM with retry/backoff. */
@Processor(QUEUE_NAMES.CRM_SYNC)
export class CrmSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  private async resolveAdapter(organizationId: string): Promise<CrmAdapter> {
    const integration = await this.prisma.integration.findFirst({
      where: { organizationId, type: "CRM", isActive: true },
      include: { credentials: true },
    });

    if (integration?.provider === "rest") {
      const apiKeyCred = integration.credentials.find((c) => c.key === "apiKey");
      const baseUrl = (integration.config as { baseUrl?: string } | null)?.baseUrl ?? this.config.get<string>("CRM_BASE_URL");
      const apiKey = apiKeyCred ? this.encryption.decrypt(apiKeyCred.encryptedValue) : this.config.get<string>("CRM_API_KEY");
      if (baseUrl && apiKey) return new RestCrmAdapter({ baseUrl, apiKey });
    }

    if (this.config.get<string>("CRM_PROVIDER") === "rest") {
      const baseUrl = this.config.get<string>("CRM_BASE_URL");
      const apiKey = this.config.get<string>("CRM_API_KEY");
      if (baseUrl && apiKey) return new RestCrmAdapter({ baseUrl, apiKey });
    }

    return mockAdapter;
  }

  async process(job: Job<CrmSyncJobData>): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: job.data.leadId } });
    if (!lead) {
      this.logger.warn(`Lead ${job.data.leadId} not found, skipping sync job.`);
      return;
    }

    let integration = await this.prisma.integration.findFirst({ where: { organizationId: lead.organizationId, type: "CRM" } });
    const adapter = await this.resolveAdapter(lead.organizationId);
    integration ??= await this.prisma.integration.create({
      data: { organizationId: lead.organizationId, type: "CRM", provider: adapter.name, name: "Default CRM" },
    });

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
        this.prisma.lead.update({ where: { id: lead.id }, data: { syncStatus: "SYNCED", crmLeadId: result.crmLeadId, syncError: null } }),
        this.prisma.leadEvent.create({ data: { leadId: lead.id, type: "lead.synced", payload: { crmLeadId: result.crmLeadId } } }),
        this.prisma.integrationLog.create({
          data: {
            integrationId: integration.id,
            action: "createLead",
            status: "SUCCESS",
            requestPayload: { leadId: lead.id },
            responsePayload: result as object,
            idempotencyKey: job.id,
          },
        }),
      ]);
    } catch (error) {
      const message = (error as Error).message;
      await this.prisma.$transaction([
        this.prisma.lead.update({ where: { id: lead.id }, data: { syncStatus: "FAILED", syncError: message } }),
        this.prisma.integrationLog.create({
          data: { integrationId: integration.id, action: "createLead", status: "ERROR", requestPayload: { leadId: lead.id }, errorMessage: message, idempotencyKey: job.id },
        }),
      ]);
      throw error; // BullMQ applies the job's retry/backoff policy
    }
  }
}
