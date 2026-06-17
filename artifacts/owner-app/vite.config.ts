import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { ownerJoinPath } from "../../lib/api-base/src/owner-urls.ts";
import { createViteApiProxy } from "../../lib/api-base/src/vite-proxy.ts";
import type { Plugin } from "vite";

function apiBaseAliases(dirname: string): Record<string, string> {
  const src = path.resolve(dirname, "..", "..", "lib", "api-base", "src");
  return {
    "@workspace/api-base/auction-bid": path.join(src, "auction-bid.ts"),
    "@workspace/api-base/auction-connection-state": path.join(src, "auction-connection-state.ts"),
    "@workspace/api-base/auction-readiness": path.join(src, "auction-readiness.ts"),
    "@workspace/api-base/dev-cors": path.join(src, "dev-cors.ts"),
    "@workspace/api-base/owner-auth": path.join(src, "owner-auth.ts"),
    "@workspace/api-base/owner-urls": path.join(src, "owner-urls.ts"),
    "@workspace/api-base/vite-proxy": path.join(src, "vite-proxy.ts"),
    "@workspace/api-base": path.join(src, "index.ts"),
  };
}

loadEnv({ path: "../../.env" });

const rawPort =
  process.env.OWNER_APP_PORT ??
  process.env.FRONTEND_PORT ??
  process.env.PORT ??
  "5174";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/** Always /owner-app/ — do not use process.env.BASE_PATH (auction-platform sets "/"). */
const basePath = "/owner-app/";

/** Full-page legacy share URLs → canonical join entry (matches production api-server redirect). */
function ownerLegacyShareRedirect(): Plugin {
  return {
    name: "owner-legacy-share-redirect",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "/").split("?")[0] ?? "/";
        const match = pathname.match(
          /^\/owner-app\/tournament\/(\d+)\/owner\/(\d+)\/?$/,
        );
        if (!match || !req.headers.accept?.includes("text/html")) {
          next();
          return;
        }
        const tid = parseInt(match[1], 10);
        const teamId = parseInt(match[2], 10);
        res.statusCode = 302;
        res.setHeader(
          "Location",
          ownerJoinPath(
            Number.isFinite(tid) ? tid : undefined,
            Number.isFinite(teamId) ? teamId : undefined,
          ),
        );
        res.end();
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    ownerLegacyShareRedirect(),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir:     "src",
      filename:   "sw.ts",
      registerType: "autoUpdate",
      // Disabled in dev: SW caching causes blank pages when owner-app is proxied via auction-platform.
      devOptions: { enabled: false },
      includeAssets: ["pwa-icon.svg", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        name:             "BidWar Owner",
        short_name:       "BidWar",
        description:      "Live auction bidding for team owners",
        theme_color:      "#09090b",
        background_color: "#09090b",
        display:          "standalone",
        orientation:      "any",
        scope:            basePath,
        start_url:        basePath,
        icons: [
          {
            src:     "pwa-icon-192.png",
            sizes:   "192x192",
            type:    "image/png",
            purpose: "any",
          },
          {
            src:     "pwa-icon-512.png",
            sizes:   "512x512",
            type:    "image/png",
            purpose: "any maskable",
          },
          {
            src:     "pwa-icon.svg",
            sizes:   "any",
            type:    "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      ...apiBaseAliases(import.meta.dirname),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
  },
  server: {
    port,
    strictPort:   true,
    host:         "0.0.0.0",
    allowedHosts: true,
    proxy: createViteApiProxy(),
    fs: { strict: true },
  },
  preview: {
    port,
    host:         "0.0.0.0",
    allowedHosts: true,
    proxy: createViteApiProxy(),
  },
});
