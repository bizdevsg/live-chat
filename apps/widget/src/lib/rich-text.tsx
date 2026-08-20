import type { ReactNode } from "react";

/**
 * Small, dependency-free "rich text" renderer for AI/agent chat bubbles.
 * Deliberately does NOT use dangerouslySetInnerHTML — it only ever builds React nodes
 * from parsed tokens, so AI-generated text (untrusted) can never inject raw HTML/script.
 * Supports: **bold**, *italic* or _italic_, `inline code`, "- " or "• " bullet lists,
 * "1. " or "1) " numbered lists, and paragraph breaks.
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((part) => part.length > 0);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
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
  type: "paragraph" | "bullet-list" | "numbered-list";
  lines: string[];
}

function toBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") continue;

    const isBullet = /^[-•]\s+/.test(line);
    const isNumbered = /^\d+[.)]\s+/.test(line);
    const cleaned = isBullet ? line.replace(/^[-•]\s+/, "") : isNumbered ? line.replace(/^\d+[.)]\s+/, "") : line;
    const wantedType: Block["type"] = isBullet ? "bullet-list" : isNumbered ? "numbered-list" : "paragraph";
    const last = blocks[blocks.length - 1];

    if (last && last.type === wantedType) {
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
