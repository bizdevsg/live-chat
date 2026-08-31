#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync } from "node:fs";
import path from "node:path";

function runGit(commandArgs) {
  return execFileSync("git", commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
chmodSync(path.join(repoRoot, ".githooks", "pre-commit"), 0o755);
runGit(["config", "core.hooksPath", ".githooks"]);
process.stdout.write("Git hooks path di-set ke .githooks\n");
