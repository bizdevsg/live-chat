import { KnowledgeService } from "./knowledge.service";

describe("KnowledgeService dashboard list", () => {
  it("searches every query word only in the article title", async () => {
    const prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new KnowledgeService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.list("site-1", {
      search: "akun mini",
      page: 1,
      pageSize: 20,
    });

    const expectedWhere = {
      siteId: "site-1",
      status: undefined,
      audience: undefined,
      categoryId: undefined,
      AND: [
        { title: { contains: "akun" } },
        { title: { contains: "mini" } },
      ],
    };
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: { updatedAt: "desc" },
      skip: 0,
      take: 20,
      include: { category: true },
    });
    expect(prisma.knowledgeDocument.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });
});
