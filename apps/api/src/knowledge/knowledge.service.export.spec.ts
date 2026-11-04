import { inflateRawSync } from "node:zlib";
import { KnowledgeService } from "./knowledge.service";

/** Lists the entries of a ZIP produced by createZip and returns name -> text. */
function unzipText(zip: Buffer): Record<string, string> {
  const endOffset = zip.length - 22;
  const total = zip.readUInt16LE(endOffset + 10);
  let cursor = zip.readUInt32LE(endOffset + 16);
  const files: Record<string, string> = {};

  for (let index = 0; index < total; index += 1) {
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const body = zip.subarray(dataStart, dataStart + compressedSize);
    files[name] = (method === 8 ? inflateRawSync(body) : body).toString("utf8");
    cursor += 46 + nameLength;
  }
  return files;
}

function doc(overrides: Record<string, unknown>) {
  return {
    id: "doc-1",
    siteId: "site-1",
    title: "Judul",
    slug: "judul",
    content: "# Isi",
    summary: null,
    audience: "PUBLIC",
    status: "ACTIVE",
    version: 1,
    sourceUrl: null,
    effectiveDate: null,
    expiredDate: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    category: null,
    ...overrides,
  };
}

describe("KnowledgeService.exportAll", () => {
  function createService(documents: unknown[]) {
    const prisma = { knowledgeDocument: { findMany: jest.fn().mockResolvedValue(documents) } };
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new KnowledgeService(
      prisma as never,
      auditLog as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, auditLog };
  }

  it("exports every article as <Kategori>/<Judul>.md with a manifest and writes an audit log", async () => {
    const { service, prisma, auditLog } = createService([
      doc({ id: "a", title: "Syarat Akun Mini", slug: "syarat-akun-mini", content: "# Akun Mini\n\nMinimal deposit.", category: { name: "Produk" } }),
      doc({ id: "b", title: "Jam Operasional", slug: "jam-operasional", content: "Senin–Jumat", category: null, status: "NON_ACTIVE" }),
    ]);

    const result = await service.exportAll("site-1", "org-1", "user-1");

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
      where: { siteId: "site-1" },
      orderBy: [{ title: "asc" }],
      include: { category: { select: { name: true } } },
    });
    expect(result.count).toBe(2);

    const files = unzipText(result.buffer);
    expect(Object.keys(files).sort()).toEqual(["Produk/Syarat Akun Mini.md", "Tanpa Kategori/Jam Operasional.md", "manifest.json"]);
    expect(files["Produk/Syarat Akun Mini.md"]).toBe("# Akun Mini\n\nMinimal deposit.");
    expect(files["Tanpa Kategori/Jam Operasional.md"]).toBe("Senin–Jumat");

    const manifest = JSON.parse(files["manifest.json"] ?? "{}");
    expect(manifest.total).toBe(2);
    expect(manifest.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "a", path: "Produk/Syarat Akun Mini.md", category: "Produk", status: "ACTIVE" }),
        expect.objectContaining({ id: "b", path: "Tanpa Kategori/Jam Operasional.md", category: null, status: "NON_ACTIVE" }),
      ]),
    );

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", actorId: "user-1", action: "knowledge.exported", afterData: { count: 2 } }),
    );
  });

  it("keeps duplicate titles apart and strips characters that are illegal in file names", async () => {
    const { service } = createService([
      doc({ id: "a", title: "Biaya: Admin/Tahunan?", slug: "biaya-1", content: "satu" }),
      doc({ id: "b", title: "Biaya: Admin/Tahunan?", slug: "biaya-2", content: "dua" }),
      doc({ id: "c", title: "///", slug: "kosong", content: "tiga" }),
    ]);

    const files = unzipText((await service.exportAll("site-1", "org-1", "user-1")).buffer);

    expect(files["Tanpa Kategori/Biaya Admin Tahunan.md"]).toBe("satu");
    expect(files["Tanpa Kategori/Biaya Admin Tahunan (2).md"]).toBe("dua");
    expect(files["Tanpa Kategori/kosong.md"]).toBe("tiga");
  });

  it("returns an archive with only the manifest when there are no articles", async () => {
    const { service } = createService([]);

    const result = await service.exportAll("site-1", "org-1", "user-1");

    expect(result.count).toBe(0);
    expect(Object.keys(unzipText(result.buffer))).toEqual(["manifest.json"]);
  });
});
