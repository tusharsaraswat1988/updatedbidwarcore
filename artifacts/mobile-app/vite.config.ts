import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createViteApiProxy } from "../../lib/api-base/src/vite-proxy.ts";

function apiBaseAliases(dirname: string): Record<string, string> {
  const src = path.resolve(dirname, "..", "..", "lib", "api-base", "src");
  return {
    "@workspace/api-base/owner-auth": path.join(src, "owner-auth.ts"),
    "@workspace/api-base/owner-urls": path.join(src, "owner-urls.ts"),
    "@workspace/api-base/owner-onboarding": path.join(src, "owner-onboarding.ts"),
    "@workspace/api-base/mobile-app-urls": path.join(src, "mobile-app-urls.ts"),
    "@workspace/api-base/mobile": path.join(src, "mobile.ts"),
    "@workspace/api-base/vite-proxy": path.join(src, "vite-proxy.ts"),
    "@workspace/api-base": path.join(src, "index.ts"),
  };
}

loadEnv({ path: "../../.env" });

const rawPort =
  process.env.MOBILE_APP_PORT?.trim() ??
  process.env.PORT?.trim() ??
  "5176";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid MOBILE_APP_PORT value: "${rawPort}"`);
}

const frontendDevPort = Number(
  process.env.FRONTEND_PORT?.trim() || process.env.WEB_PORT?.trim() || 0,
);

/** Always /mobile/ — do not use process.env.BASE_PATH. */
const basePath = "/mobile/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
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
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr:
      frontendDevPort > 0 && frontendDevPort !== port
        ? { clientPort: frontendDevPort, path: "/mobile/" }
        : undefined,
    proxy: createViteApiProxy(),
    watch:
      process.platform === "win32"
        ? { usePolling: true, interval: 1000, ignored: ["**/node_modules/**", "**/.git/**"] }
        : undefined,
    fs: { strict: true },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: createViteApiProxy(),
  },
});
