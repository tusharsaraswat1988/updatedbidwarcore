import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { compression } from "vite-plugin-compression2";
import {
  createViteDevProxies,
  ownerAppDevProxyPlugin,
} from "@workspace/api-base/vite-proxy";

function apiBaseAliases(dirname: string): Record<string, string> {
  const src = path.resolve(dirname, "..", "..", "lib", "api-base", "src");
  return {
    "@workspace/api-base/auction-bid": path.join(src, "auction-bid.ts"),
    "@workspace/api-base/auction-readiness": path.join(src, "auction-readiness.ts"),
    "@workspace/api-base/dev-cors": path.join(src, "dev-cors.ts"),
    "@workspace/api-base/owner-auth": path.join(src, "owner-auth.ts"),
    "@workspace/api-base/owner-urls": path.join(src, "owner-urls.ts"),
    "@workspace/api-base/mobile": path.join(src, "mobile.ts"),
    "@workspace/api-base/email": path.join(src, "email.ts"),
    "@workspace/api-base/organizer-account": path.join(src, "organizer-account.ts"),
    "@workspace/api-base/auction-date": path.join(src, "auction-date.ts"),
    "@workspace/api-base/vite-proxy": path.join(src, "vite-proxy.ts"),
    "@workspace/api-base": path.join(src, "index.ts"),
  };
}

loadEnv({ path: "../../.env" });

const rawPort =
  process.env.FRONTEND_PORT ?? process.env.WEB_PORT ?? process.env.PORT ?? "3000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ownerAppDevProxyPlugin(),
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
    // Production-only: make the compiled Tailwind CSS non-render-blocking.
    // Transforms <link rel="stylesheet"> → preload + onload swap so the CSS
    // downloads in parallel with JS instead of blocking the render tree.
    // The inline critical CSS in index.html prevents FOUC during this window.
    {
      name: "defer-non-critical-css",
      apply: "build" as const,
      transformIndexHtml: {
        order: "post" as const,
        handler(html: string) {
          return html.replace(
            /<link rel="stylesheet" crossorigin href="(\/[^"]+\.css)">/g,
            (_, href) =>
              `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">` +
              `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
          );
        },
      },
    },
  ],
  resolve: {
    alias: {
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
          if (id.includes("/node_modules/framer-motion/")) {
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
