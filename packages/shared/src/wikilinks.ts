export interface KnowledgeLinkTarget {
  id: string;
  title: string;
  slug?: string | null;
}

export interface ParsedWikiLink {
  raw: string;
  page: string;
  alias: string | null;
  section: string | null;
  label: string;
  normalizedPage: string;
}

const WIKI_LINK_PATTERN = /\[\[([^[\]]+?)\]\]/g;

export function slugifyKnowledgeTitle(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function normalizeLookupKey(input: string) {
  const slug = slugifyKnowledgeTitle(input);
  return slug || input.trim().toLowerCase();
}

function escapeMarkdownLabel(input: string) {
  return input.replace(/[\[\]\\]/g, "\\$&");
}

function slugifyFragment(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseWikiLink(raw: string): ParsedWikiLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const [targetPart, aliasPart] = trimmed.split("|");
  const [pagePart, ...sectionParts] = (targetPart ?? "").split("#");
  const page = (pagePart ?? "").trim();
  if (!page) return null;

  const alias = aliasPart?.trim() || null;
  const section = sectionParts.join("#").trim() || null;

  return {
    raw,
    page,
    alias,
    section,
    label: alias || page,
    normalizedPage: normalizeLookupKey(page),
  };
}

export function replaceWikiLinks(input: string, replacer: (link: ParsedWikiLink) => string) {
  return input.replace(WIKI_LINK_PATTERN, (match, inner) => {
    const parsed = parseWikiLink(String(inner));
    return parsed ? replacer(parsed) : match;
  });
}

export function resolveWikiLinkTarget(link: ParsedWikiLink, targets: KnowledgeLinkTarget[]) {
  return (
    targets.find((target) => {
      const slugMatch = target.slug ? normalizeLookupKey(target.slug) === link.normalizedPage : false;
      const titleMatch = normalizeLookupKey(target.title) === link.normalizedPage;
      return slugMatch || titleMatch;
    }) ?? null
  );
}

export function buildWikiLinkHref(link: ParsedWikiLink, targets: KnowledgeLinkTarget[], basePath = "/knowledge") {
  const target = resolveWikiLinkTarget(link, targets);
  if (!target) return null;

  const sectionSuffix = link.section ? `#${slugifyFragment(link.section)}` : "";
  return `${basePath}/${target.id}${sectionSuffix}`;
}

export function rewriteWikiLinksToMarkdown(input: string, targets: KnowledgeLinkTarget[], basePath = "/knowledge") {
  return replaceWikiLinks(input, (link) => {
    const href = buildWikiLinkHref(link, targets, basePath);
    if (!href) return link.label;
    return `[${escapeMarkdownLabel(link.label)}](${href})`;
  });
}

export function normalizeWikiLinksForIndexing(input: string) {
  return replaceWikiLinks(input, (link) => {
    const parts = [link.label];
    if (link.alias && normalizeLookupKey(link.alias) !== link.normalizedPage) {
      parts.push(link.page);
    }
    if (link.section) {
      parts.push(link.section);
    }
    return parts.join(" - ");
  });
}
