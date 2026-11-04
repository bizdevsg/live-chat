import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

// In production nginx serves the loader (apps/widget-loader) at /widget.js on the widget origin
// (see apps/widget/nginx.conf). Mirror that for `vite` dev so the embed snippet works locally;
// without this /widget.js would fall through to index.html.
const loaderFile = fileURLToPath(new URL("../widget-loader/dist/widget.js", import.meta.url));
const serveWidgetLoader = () => ({
  name: "serve-widget-loader",
  apply: "serve" as const,
  configureServer(server: { middlewares: { use: (path: string, handler: (req: unknown, res: ServerResponse, next: () => void) => void) => void } }) {
    server.middlewares.use("/widget.js", (_req, res, next) => {
      if (!existsSync(loaderFile)) return next();
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(readFileSync(loaderFile));
    });
  },
});

export default defineConfig({
  plugins: [react(), serveWidgetLoader()],
  server: { port: 3001 },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
