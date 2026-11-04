import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAiProvider } from "@solidchat/ai-core";
import { AI_CHAT_MODELS, AI_MAX_RETRIES, AI_MODELS, AI_TIMEOUT_MS, type AiChatModel } from "@solidchat/shared";
import type { AiProvider } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AiConfiguration } from "@solidchat/database";

export type AiProviderKind = "openai" | "ollama";

/**
 * Resolves the active AiConfiguration for a site (falling back to the org-level config)
 * and builds the AI provider selected by AI_PROVIDER:
 *  - "openai" (default): OpenAI with the single chat model selected in Dashboard.
 *  - "ollama": a local Ollama server via its OpenAI-compatible API. The chat model comes from
 *    OLLAMA_CHAT_MODEL (the Dashboard GPT selection is ignored), embeddings from
 *    OLLAMA_EMBEDDING_MODEL. Switching embedding model requires re-indexing knowledge
 *    (POST /api/v1/knowledge/reprocess-all) because vectors of different models are incomparable.
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

  getProviderKind(): AiProviderKind {
    return this.config.get<string>("AI_PROVIDER") === "ollama" ? "ollama" : "openai";
  }

  /** Embedding model in use — recorded on every KnowledgeChunk and AiRun. */
  getEmbeddingModel(): string {
    if (this.getProviderKind() === "ollama") {
      return this.config.get<string>("OLLAMA_EMBEDDING_MODEL") ?? "bge-m3";
    }
    return AI_MODELS.embedding;
  }

  private resolveChatModel(configuredModel: string): string {
    if (this.getProviderKind() === "ollama") {
      return this.config.get<string>("OLLAMA_CHAT_MODEL") ?? "qwen2.5:14b";
    }
    if (AI_CHAT_MODELS.includes(configuredModel as AiChatModel)) return configuredModel as AiChatModel;
    return this.config.get<AiChatModel>("OPENAI_DEFAULT_MODEL") ?? "gpt-4o-mini";
  }

  buildProvider(model: string): AiProvider {
    if (this.getProviderKind() === "ollama") {
      return new OpenAiProvider({
        providerName: "ollama",
        // Ollama ignores the key, but the OpenAI SDK refuses to start without one.
        apiKey: "ollama",
        baseURL: this.config.get<string>("OLLAMA_BASE_URL") ?? "http://host.docker.internal:11434/v1",
        apiStyle: "chat",
        classifierModel: model,
        answerModel: model,
        reviewModel: model,
        summaryModel: model,
        suggestedReplyModel: model,
        embeddingModel: this.getEmbeddingModel(),
        // Local inference is slower than OpenAI and the first call also loads the model into VRAM.
        timeoutMs: this.config.get<number>("OLLAMA_TIMEOUT_MS") ?? 120_000,
        maxRetries: 1,
        maxOutputTokens: 900,
      });
    }

    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      // Should not happen in practice — env.validation.ts requires OPENAI_API_KEY at startup —
      // but keep a loud, actionable failure here too rather than ever silently downgrading.
      throw new Error("OPENAI_API_KEY belum diset. Isi OPENAI_API_KEY (atau set AI_PROVIDER=ollama) lalu restart.");
    }
    return new OpenAiProvider({
      apiKey,
      classifierModel: model,
      answerModel: model,
      reviewModel: model,
      summaryModel: model,
      suggestedReplyModel: model,
      embeddingModel: AI_MODELS.embedding,
      timeoutMs: AI_TIMEOUT_MS,
      maxRetries: AI_MAX_RETRIES,
      maxOutputTokens: 900,
    });
  }

  async getProviderForSite(siteId: string): Promise<{ provider: AiProvider; config: AiConfiguration; model: string }> {
    const config = await this.getConfigForSite(siteId);
    const model = this.resolveChatModel(config.model);
    return { provider: this.buildProvider(model), config, model };
  }
}
