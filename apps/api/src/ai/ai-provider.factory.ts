import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAiProvider } from "@solidchat/ai-core";
import { AI_MAX_RETRIES, AI_MODELS, AI_TIMEOUT_MS, type AiChatModel } from "@solidchat/shared";
import type { AiProvider } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AiConfiguration } from "@solidchat/database";

/**
 * Resolves the active AiConfiguration for a site (falling back to the org-level config)
 * and builds an OpenAI provider with the configuration's selected chat model.
 *
 * Always builds a real OpenAiProvider — there is no mock/dummy fallback. Previously, a missing
 * or misread OPENAI_API_KEY silently degraded every conversation to a canned mock template with
 * no explanation; that's exactly the failure mode this avoids by failing loudly instead.
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

  async getConfigForOrganization(organizationId: string): Promise<AiConfiguration | null> {
    return this.prisma.aiConfiguration.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  buildProvider(model: AiChatModel): AiProvider {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      // Should not happen in practice — env.validation.ts requires OPENAI_API_KEY at startup —
      // but keep a loud, actionable failure here too rather than ever silently downgrading.
      throw new Error("OPENAI_API_KEY belum diset. Isi OPENAI_API_KEY di environment API lalu restart.");
    }
    return new OpenAiProvider({
      apiKey,
      classifierModel: model,
      answerModel: model,
      summaryModel: model,
      suggestedReplyModel: model,
      embeddingModel: AI_MODELS.embedding,
      timeoutMs: AI_TIMEOUT_MS,
      maxRetries: AI_MAX_RETRIES,
    });
  }

  async getProviderForSite(siteId: string): Promise<{ provider: AiProvider; config: AiConfiguration }> {
    const config = await this.getConfigForSite(siteId);
    return { provider: this.buildProvider(config.model as AiChatModel), config };
  }
}
