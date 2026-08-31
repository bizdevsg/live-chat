#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";

function runGit(commandArgs) {
  return execFileSync("git", commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function shouldSkipSetup() {
  if (process.env.CI === "true") return true;
  if (!existsSync(path.resolve(".git"))) return true;
  if (!existsSync(path.resolve(".githooks", "pre-commit"))) return true;
  return false;
}

if (shouldSkipSetup()) {
  process.stdout.write("Lewati setup git hooks di environment ini\n");
  process.exit(0);
}

try {
  const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
  chmodSync(path.join(repoRoot, ".githooks", "pre-commit"), 0o755);
  runGit(["config", "core.hooksPath", ".githooks"]);
  process.stdout.write("Git hooks path di-set ke .githooks\n");
} catch {
  process.stdout.write("Lewati setup git hooks di environment ini\n");
}
