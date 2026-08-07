import { createHash } from "node:crypto";

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  checksum: string;
}

const MAX_CHUNK_CHARS = 1200; // ~300 tokens, conservative for gpt-4o-mini class context windows
const MIN_CHUNK_CHARS = 200;

/** Very rough token estimate (chars/4) — good enough for chunk sizing, not for billing. */
function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function checksumOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Splits normalized document text into paragraph-aware chunks for the MySQL hybrid RAG
 * pipeline (§21). Pure function — safe to call from both the API (on publish) and the
 * worker (background reprocess job).
 */
export function chunkText(rawText: string): TextChunk[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  const paragraphs = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && buffer.length >= MIN_CHUNK_CHARS) {
      chunks.push(buffer);
      buffer = paragraph;
    } else {
      buffer = candidate;
    }

    while (buffer.length > MAX_CHUNK_CHARS) {
      chunks.push(buffer.slice(0, MAX_CHUNK_CHARS));
      buffer = buffer.slice(MAX_CHUNK_CHARS);
    }
  }
  if (buffer.trim().length > 0) chunks.push(buffer);

  return chunks.map((content, chunkIndex) => ({
    chunkIndex,
    content: content.trim(),
    tokenCount: estimateTokenCount(content),
    checksum: checksumOf(content.trim()),
  }));
}

export function checksumText(text: string): string {
  return checksumOf(text);
}
