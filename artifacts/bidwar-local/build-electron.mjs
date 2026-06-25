import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Electron main/preload must be CommonJS (.cjs) because package.json sets
 * "type": "module" for the Express server bundle (dist-server/index.js).
 * A .js entry would be loaded as ESM and crash with "exports is not defined".
 */
await Promise.all([
  build({
    entryPoints: [resolve(__dirname, "electron/main.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: resolve(__dirname, "dist-electron/main.cjs"),
    external: ["electron"],
    logLevel: "info",
  }),
  build({
    entryPoints: [resolve(__dirname, "electron/preload.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: resolve(__dirname, "dist-electron/preload.cjs"),
    external: ["electron"],
    logLevel: "info",
  }),
]);
