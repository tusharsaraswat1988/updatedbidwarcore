import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const raw = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
console.log(`[setup-integ-env] loaded. raw present: ${Boolean(raw)}`);
if (raw) {
  const u = new URL(raw);
  u.pathname = "/bidwar_test_scratch";
  const isolated = u.toString();
  process.env.DATABASE_URL = isolated;
  process.env.NEON_DATABASE_URL = isolated;
  process.env.DIRECT_DATABASE_URL = isolated.replace("-pooler.", ".");
  console.log(`[setup-integ-env] Set DATABASE_URL to isolated test database: ${u.pathname}`);
}
