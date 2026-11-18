import type { ReactNode } from "react";

/**
 * Small, dependency-free "rich text" renderer for AI/agent chat bubbles.
 * Deliberately does NOT use dangerouslySetInnerHTML — it only ever builds React nodes
 * from parsed tokens, so AI-generated text (untrusted) can never inject raw HTML/script.
 * Supports: **bold**, *italic* or _italic_, `inline code`, "- " or "• " bullet lists,
 * "1. " or "1) " numbered lists, and paragraph breaks.
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|https:\/\/[^\s<]+)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((part) => part.length > 0);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("https://")) {
      const match = part.match(/^(.*?)([),.;!?]*)$/);
      const href = match?.[1] ?? part;
      const suffix = match?.[2] ?? "";
      return (
        <span key={key}>
          <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-sky-300 underline decoration-sky-300/50 underline-offset-2 hover:text-sky-200">
            {href}
          </a>
          {suffix}
        </span>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={key} className="rounded bg-black/20 px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length > 1) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 1)
    ) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
}

interface Block {
  type: "paragraph" | "bullet-list" | "numbered-list" | "heading" | "table";
  lines: string[];
  /** Table only: optional header cells and body rows. */
  header?: string[];
  rows?: string[][];
}

const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function parseTableRow(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function toBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  // A blank line separates paragraphs; consecutive non-blank lines stay in one paragraph.
  let afterBlankLine = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      afterBlankLine = true;
      continue;
    }

    if (line.startsWith("|")) {
      const last = blocks[blocks.length - 1];
      const continuing = last?.type === "table" && !afterBlankLine;
      afterBlankLine = false;
      if (TABLE_SEPARATOR.test(line)) {
        // "|---|---|" marks the row above as the header.
        if (continuing && last && !last.header && last.rows?.length === 1) last.header = last.rows.shift();
        continue;
      }
      if (continuing && last) {
        last.rows?.push(parseTableRow(line));
      } else {
        blocks.push({ type: "table", lines: [], rows: [parseTableRow(line)] });
      }
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: "heading", lines: [heading[1] ?? ""] });
      afterBlankLine = false;
      continue;
    }
    const isBullet = /^[-•]\s+/.test(line);
    const isNumbered = /^\d+[.)]\s+/.test(line);
    const cleaned = isBullet ? line.replace(/^[-•]\s+/, "") : isNumbered ? line.replace(/^\d+[.)]\s+/, "") : line;
    const wantedType: Block["type"] = isBullet ? "bullet-list" : isNumbered ? "numbered-list" : "paragraph";
    const last = blocks[blocks.length - 1];

    const startsNewParagraph = wantedType === "paragraph" && afterBlankLine;
    afterBlankLine = false;

    if (last && last.type === wantedType && !startsNewParagraph) {
      last.lines.push(cleaned);
    } else {
      blocks.push({ type: wantedType, lines: [cleaned] });
    }
  }

  return blocks;
}

export function RichText({ content }: { content: string }) {
  const blocks = toBlocks(content);

  return (
    <>
      {blocks.map((block, bi) => {
        const key = `b-${bi}`;
        if (block.type === "heading") {
          return <p key={key} className={bi === 0 ? "font-semibold" : "mt-2 font-semibold"}>{renderInline(block.lines[0] ?? "", key)}</p>;
        }
        if (block.type === "table") {
          // A bubble is too narrow for a real multi-column table, so each row becomes a small card
          // that pairs every cell with its header.
          return (
            <div key={key} className="my-1 space-y-1.5">
              {(block.rows ?? []).map((row, ri) => (
                <div key={`${key}-${ri}`} className="rounded-lg bg-black/20 px-2.5 py-1.5 text-[0.92em]">
                  {row.map((cell, ci) => (
                    <div key={`${key}-${ri}-${ci}`}>
                      {block.header?.[ci] ? <span className="opacity-60">{block.header[ci]}: </span> : null}
                      {renderInline(cell, `${key}-${ri}-${ci}`)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        }
        if (block.type === "bullet-list") {
          return (
            <ul key={key} className="my-1 list-disc space-y-0.5 pl-4 first:mt-0">
              {block.lines.map((line, li) => (
                <li key={`${key}-${li}`}>{renderInline(line, `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "numbered-list") {
          return (
            <ol key={key} className="my-1 list-decimal space-y-0.5 pl-4 first:mt-0">
              {block.lines.map((line, li) => (
                <li key={`${key}-${li}`}>{renderInline(line, `${key}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={key} className={bi === 0 ? "" : "mt-2"}>
            {block.lines.map((line, li) => (
              <span key={`${key}-${li}`}>
                {li > 0 && <br />}
                {renderInline(line, `${key}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}
