import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test_db",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/export-token.ts"],
    },
    dangerouslyIgnoreUnhandledErrors: true,
    onConsoleLog() {
      return false;
    },
  },
});
