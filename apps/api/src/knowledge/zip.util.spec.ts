import { crc32, inflateRawSync } from "node:zlib";
import { createZip } from "./zip.util";

/** Reads a ZIP back through its central directory, the way unzip tools do. */
function readZip(zip: Buffer) {
  const endOffset = zip.length - 22;
  expect(zip.readUInt32LE(endOffset)).toBe(0x06054b50);
  const total = zip.readUInt16LE(endOffset + 10);
  let cursor = zip.readUInt32LE(endOffset + 16);

  const files: Array<{ name: string; content: Buffer; flags: number }> = [];
  for (let index = 0; index < total; index += 1) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const checksum = zip.readUInt32LE(cursor + 16);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

    expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const body = zip.subarray(dataStart, dataStart + compressedSize);
    const content = method === 8 ? inflateRawSync(body) : Buffer.from(body);

    expect(content.length).toBe(size);
    expect(crc32(content)).toBe(checksum);
    files.push({ name, content, flags });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

describe("createZip", () => {
  it("round-trips files with UTF-8 names, folders, and compressible or tiny content", () => {
    const longText = "Pembukaan akun mini dan rollover fee. ".repeat(200);
    const zip = createZip([
      { name: "Umum/Panduan Akun — Ñandú.md", data: longText, modifiedAt: new Date(2026, 10, 4, 10, 30) },
      { name: "Umum\\Pendek.md", data: "x" },
      { name: "/manifest.json", data: Buffer.from(JSON.stringify({ total: 2 })) },
    ]);

    const files = readZip(zip);
    expect(files.map((file) => file.name)).toEqual(["Umum/Panduan Akun — Ñandú.md", "Umum/Pendek.md", "manifest.json"]);
    expect(files[0]?.content.toString("utf8")).toBe(longText);
    expect(files[1]?.content.toString("utf8")).toBe("x");
    expect(JSON.parse(files[2]?.content.toString("utf8") ?? "{}")).toEqual({ total: 2 });
    expect(files.every((file) => (file.flags & 0x0800) !== 0)).toBe(true);
    expect(zip.length).toBeLessThan(longText.length);
  });

  it("produces a valid empty archive", () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual([]);
  });
});
