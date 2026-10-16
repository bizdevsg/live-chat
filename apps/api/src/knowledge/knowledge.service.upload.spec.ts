import { KnowledgeService } from "./knowledge.service";

describe("KnowledgeService upload overwrite", () => {
  it("finds existing documents by uploaded markdown filename", async () => {
    const prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([
          { id: "doc-1", slug: "panduan-deposit", title: "Panduan Deposit", status: "ACTIVE", version: 3 },
        ]),
      },
    };
    const service = new KnowledgeService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.findUploadConflicts("site-1", ["Panduan Deposit.md", "FAQ.md"]);

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
      where: {
        siteId: "site-1",
        OR: [
          { title: { in: ["Panduan Deposit", "FAQ"] } },
          { slug: { in: ["panduan-deposit", "faq"] } },
        ],
      },
      select: { id: true, slug: true, title: true, status: true, version: true },
    });
    expect(result).toEqual([
      { id: "doc-1", fileName: "Panduan Deposit.md", title: "Panduan Deposit", status: "ACTIVE", version: 3 },
    ]);
  });

  it("replaces content, increments version, clears stale chunks, and deactivates the document", async () => {
    const before = {
      id: "doc-1",
      title: "Panduan Deposit",
      content: "Konten lama",
      status: "ACTIVE",
      version: 3,
      sourceFile: "knowledge/site-1/old.md",
      category: null,
      chunks: [],
    };
    const updated = {
      ...before,
      content: "Konten baru yang lebih lengkap",
      status: "NON_ACTIVE",
      version: 4,
      sourceFile: "knowledge/site-1/new.md",
    };
    const prisma = {
      knowledgeDocument: {
        findUnique: jest.fn().mockResolvedValue(before),
        update: jest.fn().mockResolvedValue(updated),
      },
      knowledgeChunk: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const storage = { remove: jest.fn().mockResolvedValue(undefined) };
    const service = new KnowledgeService(prisma as never, auditLog as never, {} as never, storage as never, {} as never, {} as never);

    const result = await service.overwriteFromUpload(
      "doc-1",
      {
        title: "Panduan Deposit",
        content: "Konten baru yang lebih lengkap",
        sourceFile: "knowledge/site-1/new.md",
      },
      "user-1",
    );

    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: {
        title: "Panduan Deposit",
        content: "Konten baru yang lebih lengkap",
        sourceFile: "knowledge/site-1/new.md",
        status: "NON_ACTIVE",
        version: { increment: 1 },
      },
    });
    expect(prisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: "doc-1" } });
    expect(storage.remove).toHaveBeenCalledWith("knowledge/site-1/old.md");
    expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "knowledge.upload_overwritten" }));
    expect(result).toEqual(updated);
  });

  it("records aggregate embedding usage when reprocessing knowledge", async () => {
    const prisma = {
      knowledgeDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: "doc-1",
          siteId: "site-1",
          content: "Panduan pembukaan akun dengan data yang cukup untuk diproses menjadi knowledge chunk.",
          chunks: [],
          category: null,
        }),
      },
      site: { findUniqueOrThrow: jest.fn().mockResolvedValue({ organizationId: "org-1" }) },
      knowledgeChunk: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: "chunk-1" }),
      },
    };
    const provider = {
      name: "openai",
      createEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
      consumeTokenUsage: jest.fn().mockReturnValue({ inputTokens: 18, outputTokens: 0 }),
    };
    const factory = { getProviderForSite: jest.fn().mockResolvedValue({ provider }) };
    const aiRuns = { record: jest.fn().mockResolvedValue({ id: "run-1" }) };
    const service = new KnowledgeService(
      prisma as never,
      {} as never,
      factory as never,
      {} as never,
      {} as never,
      aiRuns as never,
    );

    await service.reprocess("doc-1");

    expect(aiRuns.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        siteId: "site-1",
        source: "KNOWLEDGE_REPROCESS",
        purpose: "EMBEDDING",
        inputTokens: 18,
      }),
    );
  });
});
