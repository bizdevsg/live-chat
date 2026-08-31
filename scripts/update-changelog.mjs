#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldStage = args.has("--stage");

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

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function unique(items) {
  return [...new Set(items)];
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

  for (const key of Object.keys(sections)) {
    sections[key] = unique(sections[key]).sort();
  }

  return sections;
}

function extractPreviousVersionSections(currentVersion) {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return [];
  }

  const lines = readFileSync(changelogPath, "utf8").split(/\r?\n/);
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith("## [")) {
      if (currentSection) {
        sections.push(currentSection.join("\n").trimEnd());
      }
      currentSection = [line];
      continue;
    }

    if (currentSection) {
      currentSection.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection.join("\n").trimEnd());
  }

  return sections.filter((section) => !section.startsWith(`## [${currentVersion}] -`));
}

function buildChangelog() {
  const version = readVersion();
  const currentDate = formatDate();
  const changes = getTrackedChanges();
  const sections = buildSections(changes);
  const previousSections = extractPreviousVersionSections(version);
  const lines = [
    "# Changelog",
    "",
    "Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.",
    "",
    `## [${version}] - ${currentDate}`,
  ];

  const sectionOrder = ["Added", "Changed", "Fixed", "Removed"];
  let hasEntries = false;

  for (const sectionName of sectionOrder) {
    const entries = sections[sectionName];
    if (entries.length === 0) {
      continue;
    }

    hasEntries = true;
    lines.push(`### ${sectionName}`);
    lines.push(...entries.map((entry) => `- ${entry}`));
    lines.push("");
  }

  if (!hasEntries) {
    lines.push("- Belum ada perubahan terdeteksi.");
    lines.push("");
  }

  if (previousSections.length > 0) {
    lines.push(...previousSections);
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
