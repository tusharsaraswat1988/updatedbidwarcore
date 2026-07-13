#!/usr/bin/env node
/**
 * CI / deploy guard: fail if Drizzle schema changed without a new migration file,
 * or if live DB (optional DATABASE_URL) has critical drift vs Drizzle.
 *
 * Usage:
 *   node --import tsx scripts/check-schema-governance.mjs
 *   SCHEMA_CHECK_LIVE=1 node --import tsx scripts/check-schema-governance.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "lib/db/migrations");

function gitDiffNames(baseRef) {
  try {
    const out = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      cwd: root,
      encoding: "utf8",
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

const base = process.env.SCHEMA_CI_BASE || "origin/main";
const changed = gitDiffNames(base);
const schemaChanged = changed.some((f) => f.startsWith("lib/db/src/schema/"));
const migrationChanged = changed.some((f) => f.startsWith("lib/db/migrations/"));

console.log(`[schema-ci] base=${base}`);
console.log(`[schema-ci] schemaChanged=${schemaChanged} migrationChanged=${migrationChanged}`);

if (schemaChanged && !migrationChanged) {
  console.error(
    "[schema-ci] FAIL: Drizzle schema changed without a new file under lib/db/migrations/.",
  );
  console.error("Add a versioned migration SQL (IF NOT EXISTS only) in the same PR.");
  process.exit(1);
}

const migrationFiles = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))
  : [];
console.log(`[schema-ci] migration files: ${migrationFiles.length}`);

if (process.env.SCHEMA_CHECK_LIVE === "1") {
  const { config } = await import("dotenv");
  config({ path: path.join(root, ".env") });
  const { pool, getSchemaHealthReport } = await import("@workspace/db");
  const report = await getSchemaHealthReport(pool);
  console.log(
    JSON.stringify(
      {
        driftStatus: report.driftStatus,
        critical: report.critical,
        missingTables: report.missingTables,
        missingColumns: report.missingColumns,
        requiredSql: report.requiredSql,
      },
      null,
      2,
    ),
  );
  await pool.end();
  if (report.critical) {
    console.error("[schema-ci] FAIL: live database has critical drift vs Drizzle.");
    process.exit(1);
  }
}

console.log("[schema-ci] OK");
