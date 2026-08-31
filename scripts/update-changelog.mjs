#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldStage = args.has("--stage");
const CHANGELOG_TITLE = "# Changelog";
const CHANGELOG_DESCRIPTION = "Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.";
const SECTION_NAMES = ["Added", "Changed", "Fixed", "Removed"];

function runGit(commandArgs) {
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
    const details = error instanceof Error && "stderr" in error ? String(error.stderr ?? "") : "";
    process.stderr.write(details || String(error));
    process.exit(1);
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function unique(items) {
  return [...new Set(items)];
}

function resolveGitHubRepoUrl() {
  const candidates = ["origin", "upstream"];

  for (const remoteName of candidates) {
    try {
      const rawUrl = runGit(["remote", "get-url", remoteName]).trim();
      if (!rawUrl) {
        continue;
      }

      if (rawUrl.startsWith("git@github.com:")) {
        return `https://github.com/${rawUrl.slice("git@github.com:".length).replace(/\.git$/, "")}`;
      }

      if (rawUrl.startsWith("https://github.com/") || rawUrl.startsWith("http://github.com/")) {
        return rawUrl.replace(/\.git$/, "").replace(/^http:\/\//, "https://");
      }
    } catch {
      continue;
    }
  }

  return null;
}

function readVersion() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  return typeof packageJson.version === "string" && packageJson.version.trim().length > 0
    ? packageJson.version.trim()
    : "0.1.0";
}

function parseNameStatusLine(line) {
  if (!line.trim()) {
    return null;
  }

  const parts = line.split("\t").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const statusCode = parts[0];
  const status = statusCode.charAt(0);

  if (status === "R" && parts.length >= 3) {
    return {
      status,
      from: normalizePath(parts[1]),
      to: normalizePath(parts[2]),
    };
  }

  return {
    status,
    path: normalizePath(parts.at(-1) ?? ""),
  };
}

function parsePorcelainLine(line) {
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
    return {
      status: "R",
      from: normalizePath(from),
      to: normalizePath(to),
    };
  }

  const effectiveStatus = code === "??" ? "A" : code.replace(/\s/g, "").charAt(0) || "M";

  return {
    status: effectiveStatus === "D" ? "D" : effectiveStatus === "A" ? "A" : "M",
    path: normalizePath(rawPath),
  };
}

function keepMeaningfulChanges(changes) {
  return changes.filter((change) => {
    const targetPath = "to" in change ? change.to : change.path;
    return targetPath && targetPath !== "CHANGELOG.md";
  });
}

function getTrackedChanges() {
  const stagedOutput = runGit(["diff", "--cached", "--name-status", "--find-renames", "--diff-filter=ACDMRTUXB"]);
  const stagedChanges = keepMeaningfulChanges(stagedOutput.split(/\r?\n/).map(parseNameStatusLine).filter(Boolean));

  if (stagedChanges.length > 0) {
    return stagedChanges;
  }

  const workingTreeOutput = runGit(["status", "--porcelain"]);
  return keepMeaningfulChanges(workingTreeOutput.split(/\r?\n/).map(parsePorcelainLine).filter(Boolean));
}

function buildSections(changes) {
  const sections = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: [],
  };

  for (const change of changes) {
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

  for (const sectionName of Object.keys(sections)) {
    sections[sectionName] = unique(sections[sectionName]).sort();
  }

  return sections;
}

function parseChangelog(content) {
  const lines = content.split(/\r?\n/);
  const releases = [];
  let currentRelease = null;
  let currentSection = null;
  const releaseHeadingPattern = /^## \[(.+?)\](?: - (.+))?$/;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const releaseMatch = line.match(releaseHeadingPattern);

    if (releaseMatch) {
      if (currentRelease) {
        releases.push(currentRelease);
      }

      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2] ?? null,
        sections: Object.fromEntries(SECTION_NAMES.map((sectionName) => [sectionName, []])),
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
      if (currentSection) {
        currentRelease.sections[currentSection].push(line.slice(2));
      } else if (line.slice(2).trim()) {
        currentRelease.notes.push(line.slice(2));
      }
      continue;
    }

    if (line.trim()) {
      currentRelease.notes.push(line.trim());
    }
  }

  if (currentRelease) {
    releases.push(currentRelease);
  }

  return releases;
}

function loadExistingReleases() {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return [];
  }

  const content = readFileSync(changelogPath, "utf8");
  return parseChangelog(content);
}

function mergeUnreleasedRelease(existingUnreleased, nextSections) {
  const merged = {
    version: "Unreleased",
    date: null,
    sections: Object.fromEntries(SECTION_NAMES.map((sectionName) => [sectionName, []])),
    notes: [],
  };

  for (const sectionName of SECTION_NAMES) {
    const currentEntries = nextSections[sectionName] ?? [];
    const previousEntries = existingUnreleased?.sections[sectionName] ?? [];
    merged.sections[sectionName] = unique([...currentEntries, ...previousEntries]).sort();
  }

  merged.notes = unique(existingUnreleased?.notes ?? []);

  return merged;
}

function buildVersionLinks(releases) {
  const repoUrl = resolveGitHubRepoUrl();
  if (!repoUrl) {
    return [];
  }

  const releasedVersions = releases.filter((release) => release.version !== "Unreleased").map((release) => release.version);
  const latestReleased = releasedVersions[0] ?? readVersion();
  const lines = [`[Unreleased]: ${repoUrl}/compare/v${latestReleased}...HEAD`];

  for (let index = 0; index < releasedVersions.length; index += 1) {
    const version = releasedVersions[index];
    const previousVersion = releasedVersions[index + 1];

    if (previousVersion) {
      lines.push(`[${version}]: ${repoUrl}/compare/v${previousVersion}...v${version}`);
      continue;
    }

    lines.push(`[${version}]: ${repoUrl}/releases/tag/v${version}`);
  }

  return lines;
}

function renderRelease(release) {
  const lines = [release.version === "Unreleased" ? "## [Unreleased]" : `## [${release.version}] - ${release.date ?? ""}`.trim()];
  let hasContent = false;

  for (const sectionName of SECTION_NAMES) {
    const entries = unique(release.sections[sectionName] ?? []);
    if (entries.length === 0) {
      continue;
    }

    hasContent = true;
    lines.push(`### ${sectionName}`);
    lines.push(...entries.map((entry) => `- ${entry}`));
    lines.push("");
  }

  if (!hasContent) {
    lines.push("- Belum ada perubahan terdeteksi.");
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function buildChangelog() {
  const changes = getTrackedChanges();
  const nextSections = buildSections(changes);
  const existingReleases = loadExistingReleases();
  const existingUnreleased = existingReleases.find((release) => release.version === "Unreleased") ?? null;
  const releasedVersions = existingReleases.filter((release) => release.version !== "Unreleased");
  const releases = [mergeUnreleasedRelease(existingUnreleased, nextSections), ...releasedVersions];
  const versionLinks = buildVersionLinks(releases);
  const lines = [CHANGELOG_TITLE, "", CHANGELOG_DESCRIPTION, ""];

  for (const release of releases) {
    lines.push(renderRelease(release));
    lines.push("");
  }

  if (versionLinks.length > 0) {
    lines.push(...versionLinks);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

const changelog = buildChangelog();

if (!shouldWrite) {
  process.stdout.write(changelog);
  process.exit(0);
}

const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
writeFileSync(changelogPath, changelog, "utf8");

if (shouldStage) {
  runGit(["add", "CHANGELOG.md"]);
}
