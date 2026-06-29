import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createViteApiProxy } from "../../lib/api-base/src/vite-proxy.ts";
import { stripUseClientDirective } from "../../lib/api-base/src/vite-strip-use-client.ts";

function apiBaseAliases(dirname: string): Record<string, string> {
  const src = path.resolve(dirname, "..", "..", "lib", "api-base", "src");
  const auctionSrc = path.resolve(dirname, "..", "auction-platform", "src");
  return {
    "@workspace/api-base/auction-bid": path.join(src, "auction-bid.ts"),
    "@workspace/api-base/auction-connection-state": path.join(src, "auction-connection-state.ts"),
    "@workspace/api-base/auction-readiness": path.join(src, "auction-readiness.ts"),
    "@workspace/api-base/dev-cors": path.join(src, "dev-cors.ts"),
    "@workspace/api-base/owner-auth": path.join(src, "owner-auth.ts"),
    "@workspace/api-base/owner-urls": path.join(src, "owner-urls.ts"),
    "@workspace/api-base/scoring-urls": path.join(src, "scoring-urls.ts"),
    "@workspace/api-base/mobile": path.join(src, "mobile.ts"),
    "@workspace/api-base/email": path.join(src, "email.ts"),
    "@workspace/api-base/player-gender": path.join(src, "player-gender.ts"),
    "@workspace/api-base/jersey-size": path.join(src, "jersey-size.ts"),
    "@workspace/api-base/organizer-account": path.join(src, "organizer-account.ts"),
    "@workspace/api-base/auction-date": path.join(src, "auction-date.ts"),
    "@workspace/api-base/registration-payment": path.join(src, "registration-payment.ts"),
    "@workspace/api-base/registration-declaration": path.join(src, "registration-declaration.ts"),
    "@workspace/api-base/registration-url": path.join(src, "registration-url.ts"),
    "@workspace/api-base/bid-value": path.join(src, "bid-value.ts"),
    "@workspace/api-base/platform-audio": path.join(src, "platform-audio.ts"),
    "@workspace/api-base/tournament-features": path.join(src, "tournament-features.ts"),
    "@workspace/api-base/sponsor-priority": path.join(src, "sponsor-priority.ts"),
    "@workspace/api-base/branding-assets": path.join(src, "branding-assets.ts"),
    "@workspace/api-base/player-specs-v2": path.join(src, "player-specs-v2.ts"),
    "@workspace/api-base/player-sport-profiles": path.join(src, "player-sport-profiles.ts"),
    "@workspace/api-base/vite-proxy": path.join(src, "vite-proxy.ts"),
    "@workspace/api-base": path.join(src, "index.ts"),
    "@": auctionSrc,
    "@assets": path.resolve(dirname, "..", "..", "attached_assets"),
  };
}

loadEnv({ path: "../../.env" });

const rawPort =
  process.env.SCORING_APP_PORT?.trim() ??
  process.env.PORT?.trim() ??
  "5175";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid SCORING_APP_PORT value: "${rawPort}"`);
}

const frontendDevPort = Number(
  process.env.FRONTEND_PORT?.trim() || process.env.WEB_PORT?.trim() || 0,
);

const basePath = "/scoring-app/";

export default defineConfig({
  base: basePath,
  plugins: [stripUseClientDirective(), react(), tailwindcss()],
  resolve: {
    alias: {
      html2canvas: "html2canvas-pro",
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
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr:
      frontendDevPort > 0 && frontendDevPort !== port
        ? { clientPort: frontendDevPort, path: "/scoring-app/" }
        : undefined,
    proxy: createViteApiProxy(),
    fs: {
      strict: false,
      allow: [
        path.resolve(import.meta.dirname, "..", "auction-platform"),
        path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
        path.resolve(import.meta.dirname, "..", "..", "lib"),
      ],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: createViteApiProxy(),
  },
});
