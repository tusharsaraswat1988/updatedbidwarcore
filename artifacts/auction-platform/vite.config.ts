import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";
import {
  createViteDevProxies,
  ownerAppDevProxyPlugin,
  scoringAppDevProxyPlugin,
  mobileAppDevProxyPlugin,
} from "../../lib/api-base/src/vite-proxy.ts";
import { brandingIconsDevPlugin } from "../../lib/api-base/src/vite-branding-icons-plugin.ts";
import { bootSplashHtmlPlugin } from "../../lib/api-base/src/vite-boot-splash-html-plugin.ts";
import { stripUseClientDirective } from "../../lib/api-base/src/vite-strip-use-client.ts";

function apiBaseAliases(dirname: string): Record<string, string> {
  const src = path.resolve(dirname, "..", "..", "lib", "api-base", "src");
  return {
    "@workspace/api-base/auction-bid": path.join(src, "auction-bid.ts"),
    "@workspace/api-base/auction-bid-sync": path.join(src, "auction-bid-sync.ts"),
    "@workspace/api-base/auction-unit": path.join(src, "auction-unit.ts"),
    "@workspace/api-base/auction-connection-state": path.join(src, "auction-connection-state.ts"),
    "@workspace/api-base/auction-readiness": path.join(src, "auction-readiness.ts"),
    "@workspace/api-base/auction-timer": path.join(src, "auction-timer.ts"),
    "@workspace/api-base/dev-cors": path.join(src, "dev-cors.ts"),
    "@workspace/api-base/owner-auth": path.join(src, "owner-auth.ts"),
    "@workspace/api-base/owner-urls": path.join(src, "owner-urls.ts"),
    "@workspace/api-base/mobile": path.join(src, "mobile.ts"),
    "@workspace/api-base/email": path.join(src, "email.ts"),
    "@workspace/api-base/player-gender": path.join(src, "player-gender.ts"),
    "@workspace/api-base/jersey-size": path.join(src, "jersey-size.ts"),
    "@workspace/api-base/organizer-account": path.join(src, "organizer-account.ts"),
    "@workspace/api-base/auction-date": path.join(src, "auction-date.ts"),
    "@workspace/api-base/registration-payment": path.join(src, "registration-payment.ts"),
    "@workspace/api-base/registration-declaration": path.join(src, "registration-declaration.ts"),
    "@workspace/api-base/registration-url": path.join(src, "registration-url.ts"),
    "@workspace/api-base/registration-fields": path.join(src, "registration-fields.ts"),
    "@workspace/api-base/bid-value": path.join(src, "bid-value.ts"),
    "@workspace/api-base/retained-price": path.join(src, "retained-price.ts"),
    "@workspace/api-base/team-report-rules": path.join(src, "team-report-rules.ts"),
    "@workspace/api-base/export-players-rows": path.join(src, "export-players-rows.ts"),
    "@workspace/api-base/player-spec-export": path.join(src, "player-spec-export.ts"),
    "@workspace/api-base/platform-audio": path.join(src, "platform-audio.ts"),
    "@workspace/api-base/tournament-features": path.join(src, "tournament-features.ts"),
    "@workspace/api-base/sponsor-priority": path.join(src, "sponsor-priority.ts"),
    "@workspace/api-base/branding-assets": path.join(src, "branding-assets.ts"),
    "@workspace/api-base/api-fetch": path.join(src, "api-fetch.ts"),
    "@workspace/api-base/branding-icon-head": path.join(src, "branding-icon-head.ts"),
    "@workspace/api-base/scoring-urls": path.join(src, "scoring-urls.ts"),
    "@workspace/api-base/vite-proxy": path.join(src, "vite-proxy.ts"),
    "@workspace/api-base": path.join(src, "index.ts"),
  };
}

loadEnv({ path: "../../.env" });

const rawPort =
  process.env.FRONTEND_PORT ?? process.env.WEB_PORT ?? process.env.PORT ?? "3000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";
const analyzeBundle = process.env.ANALYZE === "true";

export default defineConfig({
  base: basePath,
  plugins: [
    stripUseClientDirective(),
    bootSplashHtmlPlugin(),
    brandingIconsDevPlugin(),
    react(),
    tailwindcss(),
    scoringAppDevProxyPlugin(),
    ownerAppDevProxyPlugin(),
    mobileAppDevProxyPlugin(),
    // Pre-compress JS/CSS/HTML/SVG/JSON with both Brotli and Gzip at build
    // time. The production server serves the .br / .gz sidecar files and sets
    // Content-Encoding accordingly, with no runtime CPU cost.
    compression({
      algorithm: "brotliCompress",
      include: /\.(js|css|html|svg|json|woff2?)$/,
      threshold: 1024,
    }),
    compression({
      algorithm: "gzip",
      include: /\.(js|css|html|svg|json|woff2?)$/,
      threshold: 1024,
    }),
    ...(analyzeBundle
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  optimizeDeps: {
    include: ["html2canvas-pro", "jspdf", "xlsx"],
  },
  resolve: {
    alias: {
      html2canvas: "html2canvas-pro",
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
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
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("/node_modules/framer-motion/") || id.includes("/node_modules/motion-dom/")) {
            return "vendor-motion";
          }
          if (id.includes("/node_modules/@tanstack/")) {
            return "vendor-query";
          }
          if (id.includes("/node_modules/recharts/") || id.includes("/node_modules/d3-") || id.includes("/node_modules/d3/")) {
            return "vendor-charts";
          }
          if (id.includes("/node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "vendor-lucide";
          }
          if (id.includes("/node_modules/wouter/")) {
            return "vendor-router";
          }
          if (id.includes("/components/academy/lesson-content")) {
            return "academy-content";
          }
          if (id.includes("/components/academy/academy-search")) {
            return "academy-search";
          }
          if (id.includes("/components/academy/")) {
            return "academy-shared";
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: createViteDevProxies(),
    // Windows: polling avoids chokidar/esbuild native watcher crashes (exit 0xC0000409).
    watch:
      process.platform === "win32"
        ? { usePolling: true, interval: 1000, ignored: ["**/node_modules/**", "**/.git/**"] }
        : undefined,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: createViteDevProxies(),
  },
});
