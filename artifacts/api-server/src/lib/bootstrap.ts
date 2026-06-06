/**
 * Application bootstrap — loads .env and validates configuration before any
 * module that opens database connections or reads secrets is imported.
 */
import { config as loadEnv } from "dotenv";
import { assertRuntimeEnv } from "./runtime-env";

// cwd is artifacts/api-server when started via pnpm; monorepo .env is at repo root
loadEnv({ path: "../../.env" });

assertRuntimeEnv();
