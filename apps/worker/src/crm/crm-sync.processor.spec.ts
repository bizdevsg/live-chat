import { CrmSyncProcessor } from "./crm-sync.processor";
import { MockCrmAdapter, RestCrmAdapter } from "@solidchat/integrations";
import type { PrismaService } from "../prisma.service";
import type { EncryptionService } from "../encryption.service";

function buildProcessor(overrides: { integration?: unknown; envProvider?: string; envBaseUrl?: string; envApiKey?: string }) {
  const prisma = {
    integration: { findFirst: jest.fn().mockResolvedValue(overrides.integration ?? null) },
  } as unknown as PrismaService;

  const configValues: Record<string, string | undefined> = {
    CRM_PROVIDER: overrides.envProvider,
    CRM_BASE_URL: overrides.envBaseUrl,
    CRM_API_KEY: overrides.envApiKey,
  };
  const config = { get: (key: string) => configValues[key] } as unknown as import("@nestjs/config").ConfigService;

  const encryption = { decrypt: (v: string) => `decrypted:${v}` } as unknown as EncryptionService;

  return new CrmSyncProcessor(prisma, config, encryption);
}

describe("CrmSyncProcessor.resolveAdapter", () => {
  it("falls back to MockCrmAdapter when no integration and no env override are configured", async () => {
    const processor = buildProcessor({});
    const adapter = await (processor as unknown as { resolveAdapter: (id: string) => Promise<unknown> }).resolveAdapter("org_1");
    expect(adapter).toBeInstanceOf(MockCrmAdapter);
  });

  it("uses a REST adapter configured via an active Integration row, decrypting the stored credential", async () => {
    const processor = buildProcessor({
      integration: {
        provider: "rest",
        config: { baseUrl: "https://crm.example.com/api" },
        credentials: [{ key: "apiKey", encryptedValue: "cipher-text" }],
      },
    });
    const adapter = (await (processor as unknown as { resolveAdapter: (id: string) => Promise<unknown> }).resolveAdapter(
      "org_1",
    )) as RestCrmAdapter;
    expect(adapter).toBeInstanceOf(RestCrmAdapter);
  });

  it("falls back to env-configured REST settings when no DB Integration row exists", async () => {
    const processor = buildProcessor({ envProvider: "rest", envBaseUrl: "https://crm.example.com/api", envApiKey: "key123" });
    const adapter = await (processor as unknown as { resolveAdapter: (id: string) => Promise<unknown> }).resolveAdapter("org_1");
    expect(adapter).toBeInstanceOf(RestCrmAdapter);
  });

  it("uses MockCrmAdapter when a REST integration is configured but missing required fields", async () => {
    const processor = buildProcessor({ integration: { provider: "rest", config: null, credentials: [] } });
    const adapter = await (processor as unknown as { resolveAdapter: (id: string) => Promise<unknown> }).resolveAdapter("org_1");
    expect(adapter).toBeInstanceOf(MockCrmAdapter);
  });
});
