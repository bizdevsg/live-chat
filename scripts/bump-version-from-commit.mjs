#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { analyzeCommitMessage, readPackageVersion } from "./changelog-utils.mjs";

const messagePath = process.argv[2];
if (!messagePath) {
  process.stderr.write("Gunakan format: node scripts/bump-version-from-commit.mjs .git/COMMIT_EDITMSG\n");
  process.exit(1);
}

const commit = analyzeCommitMessage(readFileSync(messagePath, "utf8"));
if (!commit) {
  process.exit(0);
}

function bumpVersion(currentVersion, bump) {
  const [majorRaw, minorRaw, patchRaw] = currentVersion.split(".").map(Number);
  const major = Number.isFinite(majorRaw) ? majorRaw : 0;
  const minor = Number.isFinite(minorRaw) ? minorRaw : 0;
  const patch = Number.isFinite(patchRaw) ? patchRaw : 0;

  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const bump = commit.type === "major" ? "major" : commit.type === "feat" ? "minor" : "patch";
const nextVersion = bumpVersion(readPackageVersion(), bump);

// The pre-commit hook has already collected staged file changes into Unreleased. Promote that
// section now so the version, notes, and source change are committed together on the developer's
// machine — no follow-up pull from GitHub is needed.
execFileSync(process.execPath, ["scripts/release-version.mjs", nextVersion], { stdio: "inherit" });
execFileSync("git", ["add", "package.json", "CHANGELOG.md"], { stdio: "inherit" });
