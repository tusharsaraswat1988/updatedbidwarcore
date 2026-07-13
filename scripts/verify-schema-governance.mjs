import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });

const require = createRequire(resolve(root, "lib/db/package.json"));
const { Pool } = require("pg");

// Import governance without loading lib/db/src/index.ts System C side effects
const { buildSchemaContractFromDrizzle } = await import(
  "../lib/db/src/schema-governance/contract.ts"
);
const { getSchemaHealthReport } = await import(
  "../lib/db/src/schema-governance/orchestrate.ts"
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = buildSchemaContractFromDrizzle();
console.log("version", c.schemaVersion, "tables", c.tables.length);
const report = await getSchemaHealthReport(pool);
console.log(
  JSON.stringify(
    {
      driftStatus: report.driftStatus,
      critical: report.critical,
      missingTables: report.missingTables,
      missingColumns: report.missingColumns,
      requiredSql: report.requiredSql,
      autoHealEnabled: report.autoHealEnabled,
      environment: report.environment,
    },
    null,
    2,
  ),
);
await pool.end();
