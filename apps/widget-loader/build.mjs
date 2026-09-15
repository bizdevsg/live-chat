import { readFileSync } from "node:fs";

import { build, context } from "esbuild";

// Build-time config (API_URL / WIDGET_URL) is inlined into widget.js as fallbacks.
// Load a local .env if present so production builds don't silently fall back to localhost.
try {
  for (const line of readFileSync(new URL(".env", import.meta.url), "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env — fall through to defaults below
}

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/loader.ts"],
  bundle: true,
  minify: !watch,
  sourcemap: true,
  format: "iife",
  target: ["es2018"],
  outfile: "dist/widget.js",
  define: {
    __WIDGET_URL__: JSON.stringify(process.env.WIDGET_URL ?? "http://localhost:3001"),
    __API_URL__: JSON.stringify(process.env.API_URL ?? "http://localhost:4000"),
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching widget-loader for changes...");
} else {
  await build(options);
  console.log("Built dist/widget.js");
}
