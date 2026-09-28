import type { KnowledgeSource } from "@solidchat/shared";
import { formatAnswerForCustomer } from "./ai-orchestrator.service";

const officialSource: KnowledgeSource = {
  documentId: "doc_1",
  chunkId: "chunk_1",
  title: "Pendaftaran Akun",
  version: 1,
  score: 0.9,
  sourceUrl: "https://sg-berjangka.com/id/register",
};

describe("AI answer official source links", () => {
  it("keeps an evidence-backed official URL", () => {
    expect(
      formatAnswerForCustomer(`Daftar di ${officialSource.sourceUrl}`, [officialSource], false),
    ).toContain(officialSource.sourceUrl);
  });

  it("removes a URL that is not present in the answer evidence", () => {
    expect(formatAnswerForCustomer("Daftar di https://example.com/evil", [officialSource], false)).toBe("Daftar di");
  });

  it("keeps markdown labels but removes unofficial markdown-link targets", () => {
    expect(formatAnswerForCustomer("Buka [halaman ini](https://example.com/evil)", [officialSource], false)).toBe(
      "Buka halaman ini",
    );
  });

  it("deduplicates customer-visible sources and includes their official URL", () => {
    const result = formatAnswerForCustomer("Silakan ikuti langkah berikut.", [officialSource, { ...officialSource, chunkId: "chunk_2" }], true);
    expect(result.match(/https:\/\/sg-berjangka\.com\/id\/register/g)).toHaveLength(1);
    expect(result).toContain("Sumber:");
  });
});
