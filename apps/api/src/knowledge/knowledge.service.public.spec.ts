import { KnowledgeAudience, KnowledgeStatus } from "@solidchat/shared";
import { KnowledgeService } from "./knowledge.service";

describe("KnowledgeService public API", () => {
  const publicDocument = {
    id: "doc-1",
    siteId: "site-1",
    slug: "cara-daftar",
    title: "Cara Daftar",
    content: "Isi knowledge publik yang dapat dibaca consumer eksternal.",
    summary: "Panduan pendaftaran",
    audience: KnowledgeAudience.PUBLIC,
    status: KnowledgeStatus.ACTIVE,
    sourceUrl: "https://sg-berjangka.com/cara-daftar",
    sourceFile: "knowledge/private-file.md",
    createdById: "user-1",
    effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
    expiredDate: null,
    version: 2,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    categoryId: "category-1",
    category: { id: "category-1", name: "Registrasi", slug: "registrasi" },
  };

  function buildService() {
    const prisma = {
      site: { findFirst: jest.fn().mockResolvedValue({ id: "site-1" }) },
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([publicDocument]),
        findFirst: jest.fn().mockResolvedValue(publicDocument),
      },
    };
    const service = new KnowledgeService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  }

  it("lists only active, currently effective PUBLIC documents and sanitizes internal fields", async () => {
    const { service, prisma } = buildService();

    const result = await service.listPublic({ siteId: "solid-gold-main" });

    expect(prisma.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ id: "solid-gold-main" }, { siteKey: "solid-gold-main" }] },
      }),
    );
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: "site-1",
          audience: KnowledgeAudience.PUBLIC,
          status: { in: [KnowledgeStatus.ACTIVE, KnowledgeStatus.PUBLISHED] },
        }),
        orderBy: { updatedAt: "desc" },
      }),
    );
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ skip: expect.anything(), take: expect.anything() }),
    );
    expect(result).toMatchObject({ total: 1 });
    expect(result).not.toHaveProperty("page");
    expect(result).not.toHaveProperty("pageSize");
    expect(result).not.toHaveProperty("totalPages");
    expect(result.items[0]).not.toHaveProperty("sourceFile");
    expect(result.items[0]).not.toHaveProperty("createdById");
    expect(result.items[0]).not.toHaveProperty("siteId");
  });

  it("returns a public document by slug without internal metadata", async () => {
    const { service, prisma } = buildService();

    const result = await service.getPublicBySlug("cara-daftar", undefined, "solid-gold-main");

    expect(prisma.knowledgeDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slug: "cara-daftar",
          audience: KnowledgeAudience.PUBLIC,
        }),
      }),
    );
    expect(result.title).toBe("Cara Daftar");
    expect(result).not.toHaveProperty("sourceFile");
  });
});
