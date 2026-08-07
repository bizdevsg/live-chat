import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MockAiProvider, OpenAiProvider } from "@solidchat/ai-core";
import type { AiProvider } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AiConfiguration } from "@solidchat/database";

const mockProviderSingleton = new MockAiProvider();

/**
 * Resolves the active AiConfiguration for a site (falling back to the org-level config,
 * then a safe default) and builds the matching AiProvider. Configuration lives in the DB
 * so admins can change models/thresholds from the dashboard without a redeploy (§16).
 */
@Injectable()
export class AiProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getConfigForSite(siteId: string): Promise<AiConfiguration> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    const siteConfig = await this.prisma.aiConfiguration.findFirst({
      where: { siteId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (siteConfig) return siteConfig;

    const orgConfig = site
      ? await this.prisma.aiConfiguration.findFirst({
          where: { organizationId: site.organizationId, siteId: null, isActive: true },
          orderBy: { updatedAt: "desc" },
        })
      : null;
    if (orgConfig) return orgConfig;

    throw new Error(`No AiConfiguration found for site ${siteId}`);
  }

  buildProvider(aiConfig: AiConfiguration): AiProvider {
    if (aiConfig.provider === "openai") {
      const apiKey = this.config.get<string>("OPENAI_API_KEY");
      if (!apiKey) return mockProviderSingleton; // fail safe to mock rather than crash the conversation
      return new OpenAiProvider({
        apiKey,
        classifierModel: aiConfig.classifierModel,
        answerModel: aiConfig.answerModel,
        summaryModel: aiConfig.summaryModel,
        suggestedReplyModel: aiConfig.suggestedReplyModel,
        embeddingModel: aiConfig.embeddingModel,
        timeoutMs: aiConfig.timeoutMs,
        maxRetries: aiConfig.maxRetries,
        maxOutputTokens: aiConfig.maxTokens,
      });
    }
    return mockProviderSingleton;
  }

  async getProviderForSite(siteId: string): Promise<{ provider: AiProvider; config: AiConfiguration }> {
    const config = await this.getConfigForSite(siteId);
    return { provider: this.buildProvider(config), config };
  }
}
