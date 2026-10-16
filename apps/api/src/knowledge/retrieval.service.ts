import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KnowledgeRetriever } from "@solidchat/ai-core";
import {
  AI_MODELS,
  KNOWLEDGE_FULL_CONTEXT_MAX_TOKENS,
  KnowledgeAudience,
  type KnowledgeEvidence,
} from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderFactory } from "../ai/ai-provider.factory";
import { AiRunRecorderService, type AiRunContext } from "../common/ai-run-recorder.service";
import { normalizeOfficialSourceUrl, parseOfficialSourceHosts } from "./official-source-url";

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly config: ConfigService,
    private readonly aiRuns: AiRunRecorderService,
  ) {}

  private sanitizeEvidenceUrls(evidence: KnowledgeEvidence[]): KnowledgeEvidence[] {
    const allowedHosts = parseOfficialSourceHosts(this.config.get<string>("OFFICIAL_KNOWLEDGE_SOURCE_HOSTS"));
    return evidence.map((item) => {
      try {
        return { ...item, sourceUrl: normalizeOfficialSourceUrl(item.sourceUrl, allowedHosts) };
      } catch {
        return { ...item, sourceUrl: null };
      }
    });
  }

  /** Customer-facing AI may only see PUBLIC knowledge (§19). */
  async retrieveForCustomer(
    siteId: string,
    query: string,
    options: { topK?: number; includeFullContext?: boolean; tracking?: AiRunContext } = {},
  ): Promise<KnowledgeEvidence[]> {
    const { provider } = await this.aiProviderFactory.getProviderForSite(siteId);
    const retriever = new KnowledgeRetriever(this.prisma, provider);
    const startedAt = Date.now();
    const evidence = await retriever.retrieve({
      siteId,
      query,
      allowedAudiences: [KnowledgeAudience.PUBLIC],
      topK: options.topK,
      includeFullContext: options.includeFullContext ?? true,
    });
    const usage = provider.consumeTokenUsage?.();
    if (options.tracking && usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
      await this.aiRuns.record({
        ...options.tracking,
        purpose: "EMBEDDING",
        provider: provider.name,
        model: AI_MODELS.embedding,
        latencyMs: Date.now() - startedAt,
        ...usage,
      });
    }
    return this.sanitizeEvidenceUrls(evidence);
  }

  /** Suggested replies for agents may draw on PUBLIC + AGENT_ONLY, never INTERNAL (§19, §47). */
  async retrieveForAgent(siteId: string, query: string, tracking?: AiRunContext): Promise<KnowledgeEvidence[]> {
    const { provider } = await this.aiProviderFactory.getProviderForSite(siteId);
    const retriever = new KnowledgeRetriever(this.prisma, provider);
    const startedAt = Date.now();
    const evidence = await retriever.retrieve({
      siteId,
      query,
      allowedAudiences: [KnowledgeAudience.PUBLIC, KnowledgeAudience.AGENT_ONLY],
      includeFullContext: true,
      fullContextMaxTokens: KNOWLEDGE_FULL_CONTEXT_MAX_TOKENS,
    });
    const usage = provider.consumeTokenUsage?.();
    if (tracking && usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
      await this.aiRuns.record({
        ...tracking,
        purpose: "EMBEDDING",
        provider: provider.name,
        model: AI_MODELS.embedding,
        latencyMs: Date.now() - startedAt,
        ...usage,
      });
    }
    return this.sanitizeEvidenceUrls(evidence);
  }
}
