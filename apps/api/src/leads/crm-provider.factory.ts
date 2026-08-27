import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MockCrmAdapter, RestCrmAdapter } from "@solidchat/integrations";
import type { CrmAdapter } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/security/encryption.service";

const mockCrmSingleton = new MockCrmAdapter();

@Injectable()
export class CrmProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  async getAdapter(organizationId: string): Promise<CrmAdapter> {
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

    return mockCrmSingleton;
  }

  async getRealAdapter(organizationId: string): Promise<CrmAdapter | null> {
    const adapter = await this.getAdapter(organizationId);
    return adapter.name === "mock" ? null : adapter;
  }
}
