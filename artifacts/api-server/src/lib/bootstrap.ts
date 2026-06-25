/**
 * Application bootstrap — loads .env and validates configuration before any
 * module that opens database connections or reads secrets is imported.
 */
import { loadAppEnv } from "@workspace/db/load-app-env";
import { assertRuntimeEnv } from "./runtime-env";

const env = loadAppEnv();
if (!env.loaded && process.env.NODE_ENV === "production") {
  console.warn(
    `[bidwar] No ${env.file} at ${env.path} — using host-injected environment variables.`,
  );
} else if (!env.loaded) {
  console.warn(
    `[bidwar] No ${env.file} at ${env.path} — copy .env.example to .env before starting.`,
  );
}

assertRuntimeEnv();
