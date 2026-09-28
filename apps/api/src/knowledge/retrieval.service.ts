import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KnowledgeRetriever } from "@solidchat/ai-core";
import { KnowledgeAudience, type KnowledgeEvidence } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderFactory } from "../ai/ai-provider.factory";
import { normalizeOfficialSourceUrl, parseOfficialSourceHosts } from "./official-source-url";

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly config: ConfigService,
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
    options: { topK?: number; includeFullContext?: boolean } = {},
  ): Promise<KnowledgeEvidence[]> {
    const { provider } = await this.aiProviderFactory.getProviderForSite(siteId);
    const retriever = new KnowledgeRetriever(this.prisma, provider);
    const evidence = await retriever.retrieve({
      siteId,
      query,
      allowedAudiences: [KnowledgeAudience.PUBLIC],
      topK: options.topK,
      includeFullContext: options.includeFullContext ?? true,
    });
    return this.sanitizeEvidenceUrls(evidence);
  }

  /** Suggested replies for agents may draw on PUBLIC + AGENT_ONLY, never INTERNAL (§19, §47). */
  async retrieveForAgent(siteId: string, query: string): Promise<KnowledgeEvidence[]> {
    const { provider } = await this.aiProviderFactory.getProviderForSite(siteId);
    const retriever = new KnowledgeRetriever(this.prisma, provider);
    const evidence = await retriever.retrieve({
      siteId,
      query,
      allowedAudiences: [KnowledgeAudience.PUBLIC, KnowledgeAudience.AGENT_ONLY],
    });
    return this.sanitizeEvidenceUrls(evidence);
  }
}
