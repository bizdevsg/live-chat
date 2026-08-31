#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  collectCommitSections,
  collectWorkingTreeSections,
  loadChangelog,
  mergeIntoUnreleased,
  renderChangelog,
  resolveGitHubRepoUrl,
  runGit,
} from "./changelog-utils.mjs";

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldStage = args.has("--stage");
const fromRef = process.argv.includes("--from-ref") ? process.argv[process.argv.indexOf("--from-ref") + 1] : undefined;
const toRef = process.argv.includes("--to-ref") ? process.argv[process.argv.indexOf("--to-ref") + 1] : undefined;

const sections = fromRef || toRef ? collectCommitSections(fromRef, toRef) : collectWorkingTreeSections();
const releases = loadChangelog();
const unreleased = releases.find((release) => release.version === "Unreleased");
const released = releases.filter((release) => release.version !== "Unreleased");
const nextReleases = [mergeIntoUnreleased(unreleased, sections), ...released];
const changelog = renderChangelog(nextReleases, resolveGitHubRepoUrl());

if (!shouldWrite) {
  process.stdout.write(changelog);
  process.exit(0);
}

const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
writeFileSync(changelogPath, changelog, "utf8");

if (shouldStage) {
  runGit(["add", "CHANGELOG.md"]);
}
