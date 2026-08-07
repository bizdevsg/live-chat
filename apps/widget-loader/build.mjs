import { build, context } from "esbuild";

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
