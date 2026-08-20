import type { PrismaClient } from "@solidchat/database";
import {
  KNOWLEDGE_FULL_CONTEXT_MAX_TOKENS,
  KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT,
  KNOWLEDGE_RETRIEVAL_TOP_K,
  KnowledgeAudience,
  type AiProvider,
  type KnowledgeEvidence,
} from "@solidchat/shared";
import { cosineSimilarity } from "../similarity";

interface ContextRow {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[] | null;
  title: string;
  version: number;
  audience: string;
  tokenCount: number;
}

/**
 * Caps how many chunks from a single document can occupy the evidence sent to the model. Without
 * this, one long/keyword-dense document (e.g. a big master KB file) can fill every top-K slot on
 * its own, starving out every other ACTIVE document even when it's equally or more relevant.
 */
const MAX_CHUNKS_PER_DOCUMENT = 3;

/**
 * Sanity floor on the blended score — deliberately low. This is NOT meant to gate "is this
 * relevant enough to answer" (that job belongs to the model's grounding review, which can read
 * the actual text; a bare number can't). It only exists so a query with genuinely nothing to do
 * with the KB (e.g. off-topic questions) doesn't drag in the "least-bad-of-112" chunks purely
 * because ranking always returns *something*. Keep this well below real-match scores — a
 * previous, much stricter version of this floor caused entire correct answers to disappear.
 */
const MIN_RELEVANCE_SCORE = 0.12;

export interface RetrieveOptions {
  siteId: string;
  query: string;
  /** PUBLIC for customer-facing AI; PUBLIC + AGENT_ONLY for CS suggested-reply (§19). */
  allowedAudiences: string[];
  topK?: number;
  includeFullContext?: boolean;
  fullContextMaxTokens?: number;
}

function mapEvidence(row: ContextRow): KnowledgeEvidence {
  return {
    chunkId: row.chunkId,
    documentId: row.documentId,
    title: row.title,
    version: row.version,
    content: row.content,
    audience: row.audience as KnowledgeEvidence["audience"],
  };
}

function expandWithFullContext(selected: ContextRow[], allRows: ContextRow[], maxTokens: number): ContextRow[] {
  let totalTokens = selected.reduce((sum, row) => sum + row.tokenCount, 0);
  if (totalTokens >= maxTokens) return selected;

  const seenChunkIds = new Set(selected.map((row) => row.chunkId));
  const rowsByDocument = new Map<string, ContextRow[]>();
  for (const row of allRows) {
    if (seenChunkIds.has(row.chunkId)) continue;
    const existing = rowsByDocument.get(row.documentId);
    if (existing) {
      existing.push(row);
    } else {
      rowsByDocument.set(row.documentId, [row]);
    }
  }

  let layer = 0;
  let addedInPass = true;
  while (totalTokens < maxTokens && addedInPass) {
    addedInPass = false;
    for (const rows of rowsByDocument.values()) {
      const row = rows[layer];
      if (!row || seenChunkIds.has(row.chunkId)) continue;
      if (totalTokens + row.tokenCount > maxTokens) continue;
      selected.push(row);
      seenChunkIds.add(row.chunkId);
      totalTokens += row.tokenCount;
      addedInPass = true;
      if (totalTokens >= maxTokens) break;
    }
    layer += 1;
  }

  return selected;
}

/** Tokens used for the lightweight lexical bonus — 3+ chars so short connector words don't count. */
function extractQueryTokens(query: string): string[] {
  return query.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((t) => t.length >= 3) ?? [];
}

/**
 * VectorSearchAdapter implementation. Ranks every eligible chunk for the site purely by semantic
 * similarity (+ a small lexical bonus), rather than pre-filtering with MySQL FULLTEXT keyword
 * matching. FULLTEXT boolean-mode matching is fragile for short, casual customer questions —
 * typos, slang, or phrasing that just doesn't share literal words with the KB's formal wording —
 * so it either finds a near-exact match or returns nothing, with no middle ground. That "nothing"
 * used to get papered over by letting the model guess/hallucinate an answer anyway; now that the
 * model refuses to answer with zero evidence (see OpenAiProvider.generateAnswer), a fragile
 * keyword gate means the AI stops answering things it clearly knows about. Ranking the whole KB
 * by embedding similarity instead — like a normal AI knowledge base assistant (e.g. Tawk.to's) —
 * means the model always gets the most relevant material to reason over, and the two-pass
 * grounding review (not this retriever) is what decides whether that material actually supports
 * an answer. This scans up to KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT chunks per query, which is fine
 * for a KB of up to a few thousand chunks; a real ANN/vector index is the next step past that.
 */
export class KnowledgeRetriever {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: AiProvider,
  ) {}

  async retrieve(options: RetrieveOptions): Promise<KnowledgeEvidence[]> {
    const now = new Date();
    const audiences = options.allowedAudiences.length > 0 ? options.allowedAudiences : [KnowledgeAudience.PUBLIC];
    const trimmedQuery = options.query.trim();
    if (!trimmedQuery) return [];

    const rows = await this.prisma.knowledgeChunk.findMany({
      where: {
        siteId: options.siteId,
        document: {
          is: {
            status: { in: ["ACTIVE", "PUBLISHED"] },
            audience: { in: audiences },
            AND: [
              { OR: [{ effectiveDate: null }, { effectiveDate: { lte: now } }] },
              { OR: [{ expiredDate: null }, { expiredDate: { gt: now } }] },
            ],
          },
        },
      },
      select: {
        id: true,
        documentId: true,
        chunkIndex: true,
        content: true,
        embedding: true,
        tokenCount: true,
        document: { select: { title: true, version: true, audience: true } },
      },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
      take: KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT,
    });

    if (rows.length === 0) return [];

    // Dedupe on identical text as well as identical id: re-uploading or re-processing a document
    // can leave byte-identical chunks behind, and two copies of the same passage score identically,
    // so they'd occupy two evidence slots while adding nothing — squeezing out a different
    // document that actually answers the question.
    const seenChunkIds = new Set<string>();
    const seenContent = new Set<string>();
    const allRows: ContextRow[] = [];
    for (const row of rows) {
      const contentKey = row.content.trim();
      if (seenChunkIds.has(row.id) || seenContent.has(contentKey)) continue;
      seenChunkIds.add(row.id);
      seenContent.add(contentKey);
      allRows.push({
        chunkId: row.id,
        documentId: row.documentId,
        chunkIndex: row.chunkIndex,
        content: row.content,
        embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : null,
        title: row.document.title,
        version: row.document.version,
        audience: row.document.audience,
        tokenCount: row.tokenCount,
      });
    }

    const queryEmbedding = await this.provider.createEmbedding({ text: options.query });
    const queryTokens = extractQueryTokens(options.query);

    const ranked = allRows
      .map((row) => {
        const semanticScore = row.embedding && row.embedding.length > 0 ? cosineSimilarity(queryEmbedding, row.embedding) : 0;
        const contentLower = row.content.toLowerCase();
        const lexicalHits = queryTokens.filter((token) => contentLower.includes(token)).length;
        const lexicalScore = queryTokens.length > 0 ? lexicalHits / queryTokens.length : 0;
        // Semantic similarity leads (it's what makes rephrased/casual questions still match),
        // lexical overlap is just a tiebreaker/bonus — never a hard gate.
        const combined = semanticScore * 0.75 + lexicalScore * 0.25;
        return { row, combined };
      })
      .filter(({ combined }) => combined >= MIN_RELEVANCE_SCORE)
      .sort((a, b) => b.combined - a.combined);

    // Debug visibility into ranking — `docker compose logs api` after a test question shows
    // exactly which chunks were considered relevant and how strongly, without needing to poke
    // the database by hand every time retrieval looks wrong.
    console.log(
      `[KnowledgeRetriever] query="${options.query}" scanned=${allRows.length} top5=` +
        JSON.stringify(
          ranked.slice(0, 5).map((c) => ({ title: c.row.title, chunk: c.row.chunkIndex, score: Number(c.combined.toFixed(3)) })),
        ),
    );

    const topK = options.topK ?? KNOWLEDGE_RETRIEVAL_TOP_K;
    const chunksPerDocument = new Map<string, number>();
    const diversified: ContextRow[] = [];
    for (const candidate of ranked) {
      if (diversified.length >= topK) break;
      const count = chunksPerDocument.get(candidate.row.documentId) ?? 0;
      if (count >= MAX_CHUNKS_PER_DOCUMENT) continue;
      chunksPerDocument.set(candidate.row.documentId, count + 1);
      diversified.push(candidate.row);
    }

    if (!options.includeFullContext || diversified.length === 0) {
      return diversified.map(mapEvidence);
    }

    const maxTokens = options.fullContextMaxTokens ?? KNOWLEDGE_FULL_CONTEXT_MAX_TOKENS;
    const expanded = expandWithFullContext(diversified, allRows, maxTokens);
    return expanded.map(mapEvidence);
  }
}
