import { defineConfig } from "drizzle-kit";
import { loadAppEnv } from "./src/load-app-env";
import { resolveDatabaseUrl } from "./src/database-url";

loadAppEnv();

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
