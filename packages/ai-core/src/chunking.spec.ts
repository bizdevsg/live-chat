import { chunkText, checksumText } from "./chunking";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("Ini adalah artikel pendek tentang registrasi akun.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
  });

  it("splits long text into multiple chunks with increasing indices", () => {
    const paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(40);
    const longText = [paragraph, paragraph, paragraph].join("\n\n");
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.chunkIndex).toBe(i));
  });

  it("produces a stable checksum per chunk that changes when content changes", () => {
    const a = chunkText("Konten A")[0]!;
    const b = chunkText("Konten B")[0]!;
    expect(a.checksum).not.toBe(b.checksum);
    expect(a.checksum).toBe(chunkText("Konten A")[0]!.checksum);
  });

  it("ignores empty/whitespace-only input", () => {
    expect(chunkText("   \n\n   ")).toHaveLength(0);
  });
});

describe("checksumText", () => {
  it("is deterministic for identical input", () => {
    expect(checksumText("halo dunia")).toBe(checksumText("halo dunia"));
  });

  it("differs for different input", () => {
    expect(checksumText("halo dunia")).not.toBe(checksumText("halo dunia!"));
  });
});
