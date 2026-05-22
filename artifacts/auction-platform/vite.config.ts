import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { compression } from "vite-plugin-compression2";

const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    // Pre-compress JS/CSS/HTML/SVG/JSON with both Brotli and Gzip at build
    // time. The production server (server.cjs) serves the .br / .gz sidecar
    // files and sets Content-Encoding accordingly, with no runtime CPU cost.
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
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
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
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
