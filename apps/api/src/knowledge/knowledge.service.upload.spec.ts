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
    const service = new KnowledgeService(prisma as never, {} as never, {} as never, {} as never, {} as never);

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
    const service = new KnowledgeService(prisma as never, auditLog as never, {} as never, storage as never, {} as never);

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
});
