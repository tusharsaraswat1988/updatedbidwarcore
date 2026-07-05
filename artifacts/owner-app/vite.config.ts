import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { createViteApiProxy } from "../../lib/api-base/src/vite-proxy.ts";

function apiBaseAliases(dirname: string): Record<string, string> {
  const src = path.resolve(dirname, "..", "..", "lib", "api-base", "src");
  return {
    "@workspace/api-base/auction-bid": path.join(src, "auction-bid.ts"),
    "@workspace/api-base/auction-unit": path.join(src, "auction-unit.ts"),
    "@workspace/api-base/auction-connection-state": path.join(src, "auction-connection-state.ts"),
    "@workspace/api-base/auction-readiness": path.join(src, "auction-readiness.ts"),
    "@workspace/api-base/dev-cors": path.join(src, "dev-cors.ts"),
    "@workspace/api-base/owner-auth": path.join(src, "owner-auth.ts"),
    "@workspace/api-base/owner-urls": path.join(src, "owner-urls.ts"),
    "@workspace/api-base/branding-assets": path.join(src, "branding-assets.ts"),
    "@workspace/api-base/player-spec-export": path.join(src, "player-spec-export.ts"),
    "@workspace/api-base/player-gender": path.join(src, "player-gender.ts"),
    "@workspace/api-base/retained-price": path.join(src, "retained-price.ts"),
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

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir:     "src",
      filename:   "sw.ts",
      registerType: "autoUpdate",
      // Disabled in dev: SW caching causes blank pages when owner-app is proxied via auction-platform.
      devOptions: { enabled: false },
      includeAssets: [],
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
            src:     "/pwa-icon-192.png",
            sizes:   "192x192",
            type:    "image/png",
            purpose: "any",
          },
          {
            src:     "/pwa-icon-512.png",
            sizes:   "512x512",
            type:    "image/png",
            purpose: "any maskable",
          },
          {
            src:     "/favicon.svg",
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
    watch:
      process.platform === "win32"
        ? { usePolling: true, interval: 1000, ignored: ["**/node_modules/**", "**/.git/**"] }
        : undefined,
    fs: { strict: true },
  },
  preview: {
    port,
    host:         "0.0.0.0",
    allowedHosts: true,
    proxy: createViteApiProxy(),
  },
});
