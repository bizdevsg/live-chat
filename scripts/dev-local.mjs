#!/usr/bin/env node
/**
 * Runs the whole stack on the host (no Docker for the app): API, worker, widget and dashboard,
 * with the root .env loaded into every process. MySQL and Redis must already be running; MinIO is
 * started here only when a minio.exe is found (see MINIO_BIN below).
 *
 *   pnpm dev:local
 *
 * Ports: API 4000, widget 3001, dashboard 5176 (matches APP_URL). Stop everything with Ctrl+C.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (!existsSync(envFile)) {
  console.error(`[dev-local] .env tidak ditemukan di ${root}`);
  process.exit(1);
}

// Values in .env must win over variables already set in the Windows/user environment (a stale
// OPENAI_API_KEY there would otherwise shadow it, since node --env-file never overrides).
const dotEnv = parseEnv(readFileSync(envFile, "utf8"));

const DASHBOARD_PORT = process.env.DASHBOARD_PORT_LOCAL ?? "5176";
const WIDGET_PORT = process.env.WIDGET_PORT_LOCAL ?? "3001";
const MINIO_BIN = process.env.MINIO_BIN ?? path.join(homedir(), "tools", "minio", "minio.exe");
const MINIO_DATA = process.env.MINIO_DATA ?? path.join(homedir(), "tools", "minio", "data");

const COLORS = { api: 36, worker: 35, widget: 33, loader: 33, dashboard: 32, minio: 34 };
const children = [];
let stopping = false;
let redisWarned = false;

function pipe(name, stream) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      // BullMQ repeats this once per queue connection when Redis < 6.2; show it a single time.
      if (/minimum Redis version of 6\.2|^\s*Current:\s+\d/.test(line)) {
        if (!redisWarned) {
          redisWarned = true;
          console.log(`\x1b[33m[dev-local]\x1b[0m Redis lokal < 6.2 (peringatan BullMQ, tidak ditampilkan lagi). Upgrade Redis jika job antrean bermasalah.`);
        }
        continue;
      }
      if (line.trim()) console.log(`\x1b[${COLORS[name] ?? 37}m[${name}]\x1b[0m ${line}`);
    }
  });
}

function run(name, command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...dotEnv, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipe(name, child.stdout);
  pipe(name, child.stderr);
  child.on("exit", (code) => {
    if (stopping) return;
    console.error(`[dev-local] ${name} berhenti (kode ${code ?? "?"}).`);
  });
  children.push(child);
  return child;
}

const node = process.execPath;
const withEnv = (script, ...args) => [`--env-file=${envFile}`, script, ...args];
const app = (name) => path.join(root, "apps", name);

if (existsSync(MINIO_BIN)) {
  mkdirSync(MINIO_DATA, { recursive: true });
  // Reads MINIO_ROOT_USER / MINIO_ROOT_PASSWORD from the environment; node --env-file does not
  // apply to this binary, so they are forwarded explicitly from .env by loading it below.
  run("minio", MINIO_BIN, ["server", MINIO_DATA, "--console-address", ":9001"], root);
} else {
  console.warn(`[dev-local] minio.exe tidak ada di ${MINIO_BIN} -> fitur upload (S3) tidak akan jalan.`);
}

run("api", node, withEnv(path.join(app("api"), "node_modules/@nestjs/cli/bin/nest.js"), "start", "--watch"), app("api"));
run("worker", node, withEnv(path.join(app("worker"), "node_modules/@nestjs/cli/bin/nest.js"), "start", "--watch"), app("worker"));
// Rebuilds apps/widget-loader/dist/widget.js on change; the widget dev server serves it at /widget.js.
run("loader", node, withEnv(path.join(app("widget-loader"), "build.mjs"), "--watch"), app("widget-loader"));
run("widget", node, withEnv(path.join(app("widget"), "node_modules/vite/bin/vite.js"), "--port", WIDGET_PORT), app("widget"));
run("dashboard", node, withEnv(path.join(app("dashboard"), "node_modules/next/dist/bin/next"), "dev", "-p", DASHBOARD_PORT), app("dashboard"));

console.log(`[dev-local] API :4000 | widget :${WIDGET_PORT} | dashboard http://localhost:${DASHBOARD_PORT}  (Ctrl+C untuk berhenti)`);

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid && process.platform === "win32") {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
