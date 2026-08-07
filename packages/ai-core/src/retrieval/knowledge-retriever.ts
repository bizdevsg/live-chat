import { Prisma, type PrismaClient } from "@solidchat/database";
import {
  KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT,
  KNOWLEDGE_RETRIEVAL_TOP_K,
  KnowledgeAudience,
  type AiProvider,
  type KnowledgeEvidence,
} from "@solidchat/shared";
import { cosineSimilarity } from "../similarity";

interface CandidateRow {
  chunkId: string;
  documentId: string;
  content: string;
  embedding: string | null;
  title: string;
  version: number;
  audience: string;
  score: number;
}

export interface RetrieveOptions {
  siteId: string;
  query: string;
  /** PUBLIC for customer-facing AI; PUBLIC + AGENT_ONLY for CS suggested-reply (§19). */
  allowedAudiences: string[];
  topK?: number;
}

/**
 * VectorSearchAdapter implementation: MySQL FULLTEXT narrows ~50-100 candidates, then
 * cosine similarity re-ranks in the application layer (§21). Swappable for a real vector
 * DB later without touching AiOrchestrator, which only depends on `retrieve()`.
 */
export class KnowledgeRetriever {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: AiProvider,
  ) {}

  async retrieve(options: RetrieveOptions): Promise<KnowledgeEvidence[]> {
    const now = new Date();
    const audiences = options.allowedAudiences.length > 0 ? options.allowedAudiences : [KnowledgeAudience.PUBLIC];

    const sanitizedQuery = options.query.replace(/[+\-<>()~*"@]/g, " ").trim();
    if (!sanitizedQuery) return [];

    const candidates = await this.prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
      SELECT
        c.id AS chunkId,
        c.document_id AS documentId,
        c.content AS content,
        c.embedding AS embedding,
        d.title AS title,
        d.version AS version,
        d.audience AS audience,
        MATCH(c.content) AGAINST(${sanitizedQuery} IN NATURAL LANGUAGE MODE) AS score
      FROM knowledge_chunks c
      INNER JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.site_id = ${options.siteId}
        AND d.status = 'PUBLISHED'
        AND d.audience IN (${Prisma.join(audiences)})
        AND (d.effective_date IS NULL OR d.effective_date <= ${now})
        AND (d.expired_date IS NULL OR d.expired_date > ${now})
        AND MATCH(c.content) AGAINST(${sanitizedQuery} IN NATURAL LANGUAGE MODE) > 0
      ORDER BY score DESC
      LIMIT ${KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT}
    `);

    if (candidates.length === 0) return [];

    const queryEmbedding = await this.provider.createEmbedding({ text: options.query });

    const reranked = candidates
      .map((row) => {
        let embedding: number[] = [];
        try {
          embedding = row.embedding ? (JSON.parse(row.embedding) as number[]) : [];
        } catch {
          embedding = [];
        }
        const semanticScore = embedding.length > 0 ? cosineSimilarity(queryEmbedding, embedding) : 0;
        // Blend lexical (FULLTEXT) and semantic score so documents without embeddings yet still rank.
        const combined = semanticScore * 0.7 + Math.min(row.score, 10) / 10 * 0.3;
        return { row, combined };
      })
      .sort((a, b) => b.combined - a.combined)
      .slice(0, options.topK ?? KNOWLEDGE_RETRIEVAL_TOP_K);

    return reranked.map(({ row }) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      title: row.title,
      version: row.version,
      content: row.content,
      audience: row.audience as KnowledgeEvidence["audience"],
    }));
  }
}
