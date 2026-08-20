import { createHash } from "node:crypto";

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  checksum: string;
}

const MAX_CHUNK_CHARS = 1200; // ~300 tokens, conservative for gpt-4o-mini class context windows
const MIN_CHUNK_CHARS = 200;

// Markdown tables (spec sheets, fee tables, deposit tables, etc.) carry most of the "specific
// numbers" a customer actually asks for (minimum deposit, spread, margin, storage fee). Unlike
// prose, a table is meaningless once split mid-row/mid-column — a chunk with just the numbers
// and no header row (or vice versa) gives the model data it can't attribute to anything, so it
// falls back to a vague/generic answer even though the exact figure is technically "in the KB".
// Tables get a much larger budget and, if a table still doesn't fit, splits repeat the header +
// separator row on every piece so each chunk stays self-describing on its own.
const MAX_TABLE_CHUNK_CHARS = 4000;

/** Very rough token estimate (chars/4) — good enough for chunk sizing, not for billing. */
function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function checksumOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** A markdown table block: consecutive lines that are all pipe-delimited rows (`| a | b |`). */
function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function isParagraphTable(paragraph: string): boolean {
  const lines = paragraph.split("\n").filter((l) => l.trim().length > 0);
  return lines.length >= 2 && lines.every(isTableLine);
}

/** Splits an oversized table into row-groups, repeating the header + separator row on each piece. */
function splitTable(paragraph: string): string[] {
  const lines = paragraph.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 3) return [paragraph];

  const headerLine = lines[0];
  const separatorLine = lines[1];
  const dataLines = lines.slice(2);
  const headerBlock = `${headerLine}\n${separatorLine}`;

  const pieces: string[] = [];
  let buffer = headerBlock;
  for (const line of dataLines) {
    const candidate = `${buffer}\n${line}`;
    if (candidate.length > MAX_TABLE_CHUNK_CHARS && buffer !== headerBlock) {
      pieces.push(buffer);
      buffer = `${headerBlock}\n${line}`;
    } else {
      buffer = candidate;
    }
  }
  if (buffer !== headerBlock) pieces.push(buffer);
  return pieces.length > 0 ? pieces : [paragraph];
}

/** Force-splits an oversized non-table paragraph on line boundaries so a single line/table row is never cut mid-word. */
function splitOversizedText(paragraph: string, limit: number): string[] {
  if (paragraph.length <= limit) return [paragraph];
  const lines = paragraph.split("\n");
  const pieces: string[] = [];
  let buffer = "";
  for (const line of lines) {
    const candidate = buffer ? `${buffer}\n${line}` : line;
    if (candidate.length > limit && buffer) {
      pieces.push(buffer);
      buffer = line;
    } else {
      buffer = candidate;
    }
    // A single line longer than the limit on its own (rare, but possible) — fall back to a hard
    // character slice only as a last resort, never as the default path.
    while (buffer.length > limit) {
      pieces.push(buffer.slice(0, limit));
      buffer = buffer.slice(limit);
    }
  }
  if (buffer.length > 0) pieces.push(buffer);
  return pieces;
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

  const flushBuffer = () => {
    if (buffer.trim().length > 0) chunks.push(buffer);
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    if (isParagraphTable(paragraph)) {
      // Tables are always their own chunk(s) — never merged with surrounding prose and never
      // split mid-row, so the header/values for a given figure always travel together.
      flushBuffer();
      if (paragraph.length <= MAX_TABLE_CHUNK_CHARS) {
        chunks.push(paragraph);
      } else {
        chunks.push(...splitTable(paragraph));
      }
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && buffer.length >= MIN_CHUNK_CHARS) {
      flushBuffer();
      buffer = paragraph;
    } else {
      buffer = candidate;
    }

    if (buffer.length > MAX_CHUNK_CHARS) {
      const pieces = splitOversizedText(buffer, MAX_CHUNK_CHARS);
      chunks.push(...pieces.slice(0, -1));
      buffer = pieces[pieces.length - 1] ?? "";
    }
  }
  flushBuffer();

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
