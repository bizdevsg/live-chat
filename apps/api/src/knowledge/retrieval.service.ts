import { Injectable } from "@nestjs/common";
import { KnowledgeRetriever } from "@solidchat/ai-core";
import { KnowledgeAudience, type KnowledgeEvidence } from "@solidchat/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderFactory } from "../ai/ai-provider.factory";

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  /** Customer-facing AI may only see PUBLIC knowledge (§19). */
  async retrieveForCustomer(siteId: string, query: string): Promise<KnowledgeEvidence[]> {
    const { provider } = await this.aiProviderFactory.getProviderForSite(siteId);
    const retriever = new KnowledgeRetriever(this.prisma, provider);
    return retriever.retrieve({ siteId, query, allowedAudiences: [KnowledgeAudience.PUBLIC] });
  }

  /** Suggested replies for agents may draw on PUBLIC + AGENT_ONLY, never INTERNAL (§19, §47). */
  async retrieveForAgent(siteId: string, query: string): Promise<KnowledgeEvidence[]> {
    const { provider } = await this.aiProviderFactory.getProviderForSite(siteId);
    const retriever = new KnowledgeRetriever(this.prisma, provider);
    return retriever.retrieve({
      siteId,
      query,
      allowedAudiences: [KnowledgeAudience.PUBLIC, KnowledgeAudience.AGENT_ONLY],
    });
  }
}
