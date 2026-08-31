#!/usr/bin/env node

import { analyzeCommitMessage, readPackageVersion, resolveRangeFromArgs, runGit } from "./changelog-utils.mjs";

const fromRef = process.argv.includes("--from-ref") ? process.argv[process.argv.indexOf("--from-ref") + 1] : undefined;
const toRef = process.argv.includes("--to-ref") ? process.argv[process.argv.indexOf("--to-ref") + 1] : "HEAD";

function normalizeRef(ref) {
  if (!ref || /^0+$/.test(ref)) {
    const latestTag = runGit(["describe", "--tags", "--abbrev=0", "--match", "v*"], { allowFailure: true }).trim();
    if (latestTag) {
      return latestTag;
    }

    return runGit(["rev-parse", "HEAD^"], { allowFailure: true }).trim();
  }

  return ref;
}

function bumpVersion(currentVersion, bump) {
  const [majorRaw, minorRaw, patchRaw] = currentVersion.split(".").map((item) => Number(item));
  const major = Number.isFinite(majorRaw) ? majorRaw : 0;
  const minor = Number.isFinite(minorRaw) ? minorRaw : 0;
  const patch = Number.isFinite(patchRaw) ? patchRaw : 0;

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

const currentVersion = readPackageVersion();
const normalizedFromRef = normalizeRef(fromRef);
const range = resolveRangeFromArgs(normalizedFromRef, toRef);
const output = range ? runGit(["log", "--format=%s%n%b%x1e", range], { allowFailure: true }) : "";
const analyzedCommits = output
  .split("\u001e")
  .map((block) => analyzeCommitMessage(block))
  .filter(Boolean);

let bump = "";
if (analyzedCommits.some((commit) => commit.breaking)) {
  bump = "major";
} else if (analyzedCommits.some((commit) => commit.type === "feat")) {
  bump = "minor";
} else if (analyzedCommits.length > 0) {
  bump = "patch";
}

const shouldRelease = bump !== "";
const nextVersion = shouldRelease ? bumpVersion(currentVersion, bump) : currentVersion;
const outputLines = [
  `should_release=${shouldRelease ? "true" : "false"}`,
  `bump=${bump}`,
  `current_version=${currentVersion}`,
  `next_version=${nextVersion}`,
  `from_ref=${normalizedFromRef}`,
  `to_ref=${toRef}`,
];

process.stdout.write(`${outputLines.join("\n")}\n`);
