#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const CHANGELOG_TITLE = "# Changelog";
export const CHANGELOG_DESCRIPTION = "Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.";
export const SECTION_NAMES = ["Added", "Changed", "Fixed", "Removed"];
export const PLACEHOLDER_NOTE = "Belum ada perubahan terdeteksi.";

export function runGit(commandArgs, { allowFailure = false } = {}) {
  try {
    return execFileSync(
      "git",
      ["-c", "core.excludesFile=.git/info/exclude", ...commandArgs],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trimEnd();
  } catch (error) {
    if (allowFailure) {
      return "";
    }

    const details = error instanceof Error && "stderr" in error ? String(error.stderr ?? "") : "";
    process.stderr.write(details || String(error));
    process.exit(1);
  }
}

export function unique(items) {
  return [...new Set(items)];
}

export function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function readPackageVersion() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  return typeof packageJson.version === "string" && packageJson.version.trim().length > 0
    ? packageJson.version.trim()
    : "0.1.0";
}

export function resolveGitHubRepoUrl() {
  const candidates = ["origin", "upstream"];

  for (const remoteName of candidates) {
    const rawUrl = runGit(["remote", "get-url", remoteName], { allowFailure: true }).trim();
    if (!rawUrl) {
      continue;
    }

    if (rawUrl.startsWith("git@github.com:")) {
      return `https://github.com/${rawUrl.slice("git@github.com:".length).replace(/\.git$/, "")}`;
    }

    if (rawUrl.startsWith("https://github.com/") || rawUrl.startsWith("http://github.com/")) {
      return rawUrl.replace(/\.git$/, "").replace(/^http:\/\//, "https://");
    }
  }

  return null;
}

export function createEmptySections() {
  return Object.fromEntries(SECTION_NAMES.map((sectionName) => [sectionName, []]));
}

export function createEmptyUnreleasedRelease() {
  return {
    version: "Unreleased",
    date: null,
    sections: createEmptySections(),
    notes: [PLACEHOLDER_NOTE],
  };
}

function appendSentencePunctuation(value) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function toSentence(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return appendSentencePunctuation(sentence);
}

export function analyzeCommitMessage(rawMessage) {
  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const subject = lines[0] ?? "";
  const body = lines.slice(1).join("\n");

  if (!subject || /^chore\(release\): v\d+\.\d+\.\d+/i.test(subject)) {
    return null;
  }

  const conventionalMatch = subject.match(/^([a-zA-Z]+)(\([^)]+\))?(!)?:\s*(.+)$/);
  const type = conventionalMatch?.[1]?.toLowerCase() ?? null;
  const description = conventionalMatch?.[4]?.trim() ?? subject;
  const breaking = Boolean(conventionalMatch?.[3]) || /BREAKING CHANGE:/i.test(body);

  let section = "Changed";
  if (breaking) {
    section = "Changed";
  } else if (type === "feat") {
    section = "Added";
  } else if (type && ["fix", "perf", "patch"].includes(type)) {
    section = "Fixed";
  } else if (type && ["remove", "delete"].includes(type)) {
    section = "Removed";
  } else if (/^(remove|delete)\b/i.test(description)) {
    section = "Removed";
  }

  const entry = toSentence(description);
  if (!entry) {
    return null;
  }

  return {
    type,
    breaking,
    section,
    entry,
    subject,
  };
}

export function parseChangelog(content) {
  const lines = content.split(/\r?\n/);
  const releases = [];
  let currentRelease = null;
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const releaseMatch = line.match(/^## \[(.+?)\](?: - (.+))?$/);
    if (releaseMatch) {
      if (currentRelease) {
        releases.push(normalizeRelease(currentRelease));
      }

      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2] ?? null,
        sections: createEmptySections(),
        notes: [],
      };
      currentSection = null;
      continue;
    }

    if (!currentRelease) {
      continue;
    }

    const sectionMatch = line.match(/^### (Added|Changed|Fixed|Removed)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    if (line.startsWith("[")) {
      continue;
    }

    if (line.startsWith("- ")) {
      const item = line.slice(2).trim();
      if (!item) {
        continue;
      }

      if (currentSection) {
        currentRelease.sections[currentSection].push(item);
      } else {
        currentRelease.notes.push(item);
      }
    }
  }

  if (currentRelease) {
    releases.push(normalizeRelease(currentRelease));
  }

  return releases;
}

export function loadChangelog() {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return [createEmptyUnreleasedRelease()];
  }

  const content = readFileSync(changelogPath, "utf8");
  const parsed = parseChangelog(content);
  if (parsed.length === 0) {
    return [createEmptyUnreleasedRelease()];
  }

  if (parsed[0]?.version !== "Unreleased") {
    return [createEmptyUnreleasedRelease(), ...parsed];
  }

  return parsed;
}

export function normalizeRelease(release) {
  const sections = createEmptySections();
  for (const sectionName of SECTION_NAMES) {
    sections[sectionName] = unique((release.sections?.[sectionName] ?? []).map((item) => item.trim()).filter(Boolean));
  }

  const notes = unique((release.notes ?? []).map((item) => item.trim()).filter(Boolean));

  return {
    version: release.version,
    date: release.date ?? null,
    sections,
    notes,
  };
}

export function meaningfulNotes(notes) {
  const cleaned = unique((notes ?? []).map((item) => item.trim()).filter(Boolean));
  return cleaned.filter((item) => item !== PLACEHOLDER_NOTE);
}

export function mergeIntoUnreleased(existingRelease, incomingSections) {
  const normalizedExisting = normalizeRelease(existingRelease ?? createEmptyUnreleasedRelease());
  const merged = {
    version: "Unreleased",
    date: null,
    sections: createEmptySections(),
    notes: meaningfulNotes(normalizedExisting.notes),
  };

  for (const sectionName of SECTION_NAMES) {
    merged.sections[sectionName] = unique([
      ...normalizedExisting.sections[sectionName],
      ...(incomingSections[sectionName] ?? []),
    ]).sort();
  }

  return merged;
}

export function hasReleaseContent(release) {
  return SECTION_NAMES.some((sectionName) => (release.sections?.[sectionName] ?? []).length > 0) || meaningfulNotes(release.notes).length > 0;
}

export function renderRelease(release) {
  const normalized = normalizeRelease(release);
  const lines = [normalized.version === "Unreleased" ? "## [Unreleased]" : `## [${normalized.version}] - ${normalized.date ?? formatDate()}`];
  let hasSections = false;

  for (const sectionName of SECTION_NAMES) {
    const entries = normalized.sections[sectionName];
    if (entries.length === 0) {
      continue;
    }

    hasSections = true;
    lines.push(`### ${sectionName}`);
    lines.push(...entries.map((entry) => `- ${entry}`));
    lines.push("");
  }

  const notes = meaningfulNotes(normalized.notes);
  if (notes.length > 0) {
    lines.push(...notes.map((note) => `- ${note}`));
    lines.push("");
  }

  if (!hasSections && notes.length === 0) {
    lines.push(`- ${PLACEHOLDER_NOTE}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function buildFooterLines(releases, repoUrl = resolveGitHubRepoUrl()) {
  if (!repoUrl) {
    return [];
  }

  const releasedVersions = releases.filter((release) => release.version !== "Unreleased").map((release) => release.version);
  const latestReleasedVersion = releasedVersions[0] ?? readPackageVersion();
  const footerLines = [`[Unreleased]: ${repoUrl}/compare/v${latestReleasedVersion}...HEAD`];

  for (let index = 0; index < releasedVersions.length; index += 1) {
    const version = releasedVersions[index];
    const previousVersion = releasedVersions[index + 1];

    if (previousVersion) {
      footerLines.push(`[${version}]: ${repoUrl}/compare/v${previousVersion}...v${version}`);
    } else {
      footerLines.push(`[${version}]: ${repoUrl}/releases/tag/v${version}`);
    }
  }

  return footerLines;
}

export function renderChangelog(releases, repoUrl = resolveGitHubRepoUrl()) {
  const normalizedReleases = releases.map((release) => normalizeRelease(release));
  const lines = [CHANGELOG_TITLE, "", CHANGELOG_DESCRIPTION, ""];

  for (const release of normalizedReleases) {
    lines.push(renderRelease(release));
    lines.push("");
  }

  const footerLines = buildFooterLines(normalizedReleases, repoUrl);
  if (footerLines.length > 0) {
    lines.push(...footerLines);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function parseDiffNameStatusLine(line) {
  if (!line.trim()) {
    return null;
  }

  const parts = line.split("\t").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const status = parts[0].charAt(0);
  if (status === "R" && parts.length >= 3) {
    return { status, from: normalizePath(parts[1]), to: normalizePath(parts[2]) };
  }

  return {
    status,
    path: normalizePath(parts.at(-1) ?? ""),
  };
}

function parsePorcelainStatusLine(line) {
  if (!line.trim()) {
    return null;
  }

  const code = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  if (!rawPath) {
    return null;
  }

  if (rawPath.includes(" -> ")) {
    const [from, to] = rawPath.split(" -> ");
    return { status: "R", from: normalizePath(from), to: normalizePath(to) };
  }

  const status = code === "??" ? "A" : code.replace(/\s/g, "").charAt(0) || "M";
  return {
    status: status === "D" ? "D" : status === "A" ? "A" : "M",
    path: normalizePath(rawPath),
  };
}

export function collectWorkingTreeSections() {
  const sections = createEmptySections();
  const stagedOutput = runGit(["diff", "--cached", "--name-status", "--find-renames", "--diff-filter=ACDMRTUXB"], { allowFailure: true });
  const stagedChanges = stagedOutput.split(/\r?\n/).map(parseDiffNameStatusLine).filter(Boolean);
  const changes = stagedChanges.length > 0
    ? stagedChanges
    : runGit(["status", "--porcelain"], { allowFailure: true }).split(/\r?\n/).map(parsePorcelainStatusLine).filter(Boolean);

  for (const change of changes) {
    const targetPath = "to" in change ? change.to : change.path;
    if (!targetPath || targetPath === "CHANGELOG.md") {
      continue;
    }

    if (change.status === "A" && "path" in change) {
      sections.Added.push(`Menambahkan \`${change.path}\`.`);
      continue;
    }

    if (change.status === "D" && "path" in change) {
      sections.Removed.push(`Menghapus \`${change.path}\`.`);
      continue;
    }

    if (change.status === "R" && "from" in change && "to" in change) {
      sections.Changed.push(`Mengganti nama \`${change.from}\` menjadi \`${change.to}\`.`);
      continue;
    }

    if ("path" in change) {
      sections.Changed.push(`Memperbarui \`${change.path}\`.`);
    }
  }

  for (const sectionName of SECTION_NAMES) {
    sections[sectionName] = unique(sections[sectionName]).sort();
  }

  return sections;
}

export function resolveRangeFromArgs(fromRef, toRef) {
  if (fromRef && toRef) {
    return `${fromRef}..${toRef}`;
  }

  if (fromRef) {
    return `${fromRef}..HEAD`;
  }

  return "";
}

export function collectCommitSections(fromRef, toRef) {
  const sections = createEmptySections();
  const range = resolveRangeFromArgs(fromRef, toRef);
  if (!range) {
    return sections;
  }

  const output = runGit(["log", "--format=%s%n%b%x1e", range], { allowFailure: true });
  if (!output) {
    return sections;
  }

  for (const block of output.split("\u001e")) {
    const analyzed = analyzeCommitMessage(block);
    if (!analyzed) {
      continue;
    }

    sections[analyzed.section].push(analyzed.entry);
  }

  for (const sectionName of SECTION_NAMES) {
    sections[sectionName] = unique(sections[sectionName]).sort();
  }

  return sections;
}
