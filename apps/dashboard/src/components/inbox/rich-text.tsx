import type { ReactNode } from "react";

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return <code key={key} className="rounded bg-black/20 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 1) || (part.startsWith("_") && part.endsWith("_") && part.length > 1)) return <em key={key}>{part.slice(1, -1)}</em>;
    return <span key={key}>{part}</span>;
  });
}

type Block = { type: "paragraph" | "bullet-list" | "numbered-list"; lines: string[] };

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const isBullet = /^[-\u2022]\s+/.test(line);
    const isNumbered = /^\d+[.)]\s+/.test(line);
    const type: Block["type"] = isBullet ? "bullet-list" : isNumbered ? "numbered-list" : "paragraph";
    const cleaned = isBullet ? line.replace(/^[-\u2022]\s+/, "") : isNumbered ? line.replace(/^\d+[.)]\s+/, "") : line;
    const last = blocks.at(-1);

    if (last?.type === type) last.lines.push(cleaned);
    else blocks.push({ type, lines: [cleaned] });
  }

  return blocks;
}

/** Matches the compact rich-text treatment used by Widget message bubbles. */
export function RichText({ content }: { content: string }) {
  return (
    <>
      {toBlocks(content).map((block, blockIndex) => {
        const key = `block-${blockIndex}`;
        if (block.type === "bullet-list") return <ul key={key} className="my-1 list-disc space-y-0.5 pl-4 first:mt-0">{block.lines.map((line, lineIndex) => <li key={`${key}-${lineIndex}`}>{renderInline(line, `${key}-${lineIndex}`)}</li>)}</ul>;
        if (block.type === "numbered-list") return <ol key={key} className="my-1 list-decimal space-y-0.5 pl-4 first:mt-0">{block.lines.map((line, lineIndex) => <li key={`${key}-${lineIndex}`}>{renderInline(line, `${key}-${lineIndex}`)}</li>)}</ol>;
        return <p key={key} className={blockIndex === 0 ? "" : "mt-2"}>{block.lines.map((line, lineIndex) => <span key={`${key}-${lineIndex}`}>{lineIndex > 0 ? <br /> : null}{renderInline(line, `${key}-${lineIndex}`)}</span>)}</p>;
      })}
    </>
  );
}
