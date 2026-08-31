#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const versionArg = rawArgs.find((arg) => !arg.startsWith("--")) ?? rawArgs.find((arg) => arg.startsWith("--version="))?.slice("--version=".length);
const nextVersion = versionArg?.trim();

if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  process.stderr.write("Gunakan format: node scripts/release-version.mjs 0.2.0\n");
  process.exit(1);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updatePackageVersion(version) {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  packageJson.version = version;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function buildEmptyUnreleasedSection() {
  return ["## [Unreleased]", "- Belum ada perubahan terdeteksi."].join("\n");
}

function updateChangelog(version) {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  const content = readFileSync(changelogPath, "utf8");
  const unreleasedMatch = content.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## \[|\n\[Unreleased\]:|$)/);

  if (!unreleasedMatch) {
    process.stderr.write("CHANGELOG.md tidak memiliki section Unreleased.\n");
    process.exit(1);
  }

  const unreleasedBody = unreleasedMatch[1].trim();
  const nextReleaseSection = `## [${version}] - ${formatDate()}${unreleasedBody ? `\n${unreleasedBody}` : "\n- Belum ada perubahan terdeteksi."}`;
  const previousReleaseMatch = content.match(/^## \[(\d+\.\d+\.\d+)\] - .+$/m);
  const previousVersion = previousReleaseMatch?.[1] ?? null;
  const replacedSection = content.replace(
    /## \[Unreleased\]\n[\s\S]*?(?=\n## \[|\n\[Unreleased\]:|$)/,
    `${buildEmptyUnreleasedSection()}\n\n${nextReleaseSection}`,
  );

  const footerPattern = /^\[(Unreleased|\d+\.\d+\.\d+)\]: .+$/gm;
  const existingFooterLines = replacedSection.match(footerPattern) ?? [];
  const footerMap = new Map(
    existingFooterLines.map((line) => {
      const match = line.match(/^\[(.+?)\]: (.+)$/);
      return [match?.[1] ?? "", match?.[2] ?? ""];
    }),
  );

  footerMap.set("Unreleased", `https://github.com/bizdevsg/live-chat/compare/v${version}...HEAD`);
  footerMap.set(
    version,
    previousVersion
      ? `https://github.com/bizdevsg/live-chat/compare/v${previousVersion}...v${version}`
      : `https://github.com/bizdevsg/live-chat/releases/tag/v${version}`,
  );

  const cleanedContent = replacedSection.replace(new RegExp(`${footerPattern.source}\\n?`, "gm"), "").trimEnd();
  const footerLines = ["[Unreleased]: " + footerMap.get("Unreleased")];

  if (footerMap.has(version)) {
    footerLines.push(`[${version}]: ${footerMap.get(version)}`);
  }

  for (const [key, value] of footerMap.entries()) {
    if (!key || key === "Unreleased" || key === version) {
      continue;
    }

    if (/^\d+\.\d+\.\d+$/.test(key)) {
      footerLines.push(`[${key}]: ${value}`);
    }
  }

  const nextContent = `${cleanedContent}\n\n${footerLines.join("\n")}\n`;
  const dedupedContent = nextContent.replace(
    new RegExp(`(## \\[${escapeRegExp(version)}\\] - ${escapeRegExp(formatDate())}\\n(?:[\\s\\S]*?))(\\n\\1)+`, "g"),
    "$1",
  );

  writeFileSync(changelogPath, dedupedContent, "utf8");
}

updatePackageVersion(nextVersion);
updateChangelog(nextVersion);
