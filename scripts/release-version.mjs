#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createEmptyUnreleasedRelease,
  formatDate,
  hasReleaseContent,
  loadChangelog,
  meaningfulNotes,
  normalizeRelease,
  renderChangelog,
  resolveGitHubRepoUrl,
} from "./changelog-utils.mjs";

const rawArgs = process.argv.slice(2);
const versionArg = rawArgs.find((arg) => !arg.startsWith("--")) ?? rawArgs.find((arg) => arg.startsWith("--version="))?.slice("--version=".length);
const nextVersion = versionArg?.trim();

if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  process.stderr.write("Gunakan format: node scripts/release-version.mjs 0.2.0\n");
  process.exit(1);
}

function updatePackageVersion(version) {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  packageJson.version = version;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

const releases = loadChangelog();
const unreleased = normalizeRelease(releases.find((release) => release.version === "Unreleased") ?? createEmptyUnreleasedRelease());
const previousReleased = releases.filter((release) => release.version !== "Unreleased" && release.version !== nextVersion);
const releaseNotes = meaningfulNotes(unreleased.notes);
const nextRelease = {
  version: nextVersion,
  date: formatDate(),
  sections: unreleased.sections,
  notes: releaseNotes,
};

if (!hasReleaseContent(nextRelease)) {
  nextRelease.notes = ["Belum ada perubahan terdeteksi."];
}

updatePackageVersion(nextVersion);

const nextReleases = [createEmptyUnreleasedRelease(), nextRelease, ...previousReleased];
writeFileSync(path.join(process.cwd(), "CHANGELOG.md"), renderChangelog(nextReleases, resolveGitHubRepoUrl()), "utf8");
