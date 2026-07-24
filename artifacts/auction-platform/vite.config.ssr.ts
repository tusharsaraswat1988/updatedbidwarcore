import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
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
    "@workspace/api-base/branding-icon-head": path.join(src, "branding-icon-head.ts"),
    "@workspace/api-base/scoring-urls": path.join(src, "scoring-urls.ts"),
    "@workspace/api-base/api-fetch": path.join(src, "api-fetch.ts"),
    "@workspace/api-base/vite-proxy": path.join(src, "vite-proxy.ts"),
    "@workspace/api-base": path.join(src, "index.ts"),
  };
}

loadEnv({ path: "../../.env" });

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [stripUseClientDirective(), react(), tailwindcss()],
  resolve: {
    alias: {
      html2canvas: "html2canvas-pro",
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      ...apiBaseAliases(import.meta.dirname),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    ssr: "src/server-render/entry-server.tsx",
    outDir: path.resolve(import.meta.dirname, "dist/server"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        entryFileNames: "entry-server.js",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
