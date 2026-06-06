import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// pnpm runs this with cwd = lib/db; repo .env lives two levels up
loadEnv({ path: "../../.env" });
import { resolveDatabaseUrl } from "./src/database-url";

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
