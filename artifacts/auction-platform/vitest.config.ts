import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    // Suites that use node:test (not vitest).
    exclude: [
      "**/sport-capabilities.test.ts",
      "**/auction-create-bindings.test.ts",
      "**/mission-control-presenter.test.ts",
      "**/live-ops-return-paths.test.ts",
      "**/badminton-sport-nav.test.ts",
      "**/mission-control-ops.test.ts",
      "**/badminton-tournament-mode.test.ts",
      "**/badminton-ia-workflow.test.ts",
    ],
  },
});
