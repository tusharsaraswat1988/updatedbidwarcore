import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT ?? "5174";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/owner-app/";

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
      devOptions: { enabled: true, type: "module" },
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
    fs: { strict: true },
  },
  preview: {
    port,
    host:         "0.0.0.0",
    allowedHosts: true,
  },
});
