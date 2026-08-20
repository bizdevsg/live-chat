import type { PrismaClient } from "@solidchat/database";
import { KnowledgeAudience, type AiProvider } from "@solidchat/shared";
import { KnowledgeRetriever } from "./knowledge-retriever";

describe("KnowledgeRetriever", () => {
  it("backfills broader active knowledge when full-context mode is enabled", async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        chunkIndex: 0,
        content: "Withdrawal dapat dilakukan melalui aplikasi resmi.",
        embedding: null,
        title: "Withdrawal",
        version: 1,
        audience: "PUBLIC",
        score: 5,
        tokenCount: 50,
      },
    ]);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "chunk_1",
        documentId: "doc_1",
        chunkIndex: 0,
        content: "Withdrawal dapat dilakukan melalui aplikasi resmi.",
        tokenCount: 50,
        document: { title: "Withdrawal", version: 1, audience: "PUBLIC" },
      },
      {
        id: "chunk_2",
        documentId: "doc_2",
        chunkIndex: 0,
        content: "Akun harus terverifikasi sebelum penarikan diproses.",
        tokenCount: 60,
        document: { title: "Verifikasi Akun", version: 2, audience: "PUBLIC" },
      },
    ]);
    const prisma = {
      $queryRaw: queryRaw,
      knowledgeChunk: { findMany },
    } as unknown as PrismaClient;
    const provider = {
      createEmbedding: jest.fn().mockResolvedValue([1, 0, 0]),
    } as unknown as AiProvider;

    const retriever = new KnowledgeRetriever(prisma, provider);
    const result = await retriever.retrieve({
      siteId: "site_1",
      query: "cara withdrawal",
      allowedAudiences: [KnowledgeAudience.PUBLIC],
      includeFullContext: true,
      fullContextMaxTokens: 200,
    });

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.documentId)).toEqual(["doc_1", "doc_2"]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("stops backfilling when the full-context token budget is exhausted", async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        chunkIndex: 0,
        content: "Withdrawal dapat dilakukan melalui aplikasi resmi.",
        embedding: null,
        title: "Withdrawal",
        version: 1,
        audience: "PUBLIC",
        score: 5,
        tokenCount: 50,
      },
    ]);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "chunk_1",
        documentId: "doc_1",
        chunkIndex: 0,
        content: "Withdrawal dapat dilakukan melalui aplikasi resmi.",
        tokenCount: 50,
        document: { title: "Withdrawal", version: 1, audience: "PUBLIC" },
      },
      {
        id: "chunk_2",
        documentId: "doc_2",
        chunkIndex: 0,
        content: "Akun harus terverifikasi sebelum penarikan diproses.",
        tokenCount: 60,
        document: { title: "Verifikasi Akun", version: 2, audience: "PUBLIC" },
      },
    ]);
    const prisma = {
      $queryRaw: queryRaw,
      knowledgeChunk: { findMany },
    } as unknown as PrismaClient;
    const provider = {
      createEmbedding: jest.fn().mockResolvedValue([1, 0, 0]),
    } as unknown as AiProvider;

    const retriever = new KnowledgeRetriever(prisma, provider);
    const result = await retriever.retrieve({
      siteId: "site_1",
      query: "cara withdrawal",
      allowedAudiences: [KnowledgeAudience.PUBLIC],
      includeFullContext: true,
      fullContextMaxTokens: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.documentId).toBe("doc_1");
  });
});
