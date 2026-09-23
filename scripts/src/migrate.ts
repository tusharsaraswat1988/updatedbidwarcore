/**
 * ============================================================================
 * BIDWAR CANONICAL VERSIONED MIGRATION RUNNER
 * ============================================================================
 * Discovers and applies all versioned SQL migrations from lib/db/migrations/
 * in strict numerical/lexicographical order.
 * Tracks applied migrations in drizzle.__drizzle_migrations and __drizzle_migrations.
 * Fully idempotent and safe for production deploy lifecycles.
 * ============================================================================
 */

import { loadAppEnv } from "@workspace/db/load-app-env";
import pg from "pg";
import { resolveDatabaseUrl } from "@workspace/db/database-url";
import { runVersionedMigrations } from "@workspace/db/migrator";

const env = loadAppEnv();
if (!env.loaded) {
  console.error(
    `[migrate] Missing ${env.file} at ${env.path} (NODE_ENV=${env.nodeEnv}).`,
  );
  process.exit(1);
}
console.log(`[migrate] using ${env.file} (${env.nodeEnv})`);

const { Client } = pg;

const client = new Client({
  connectionString: resolveDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("[migrate] Connected to database.");

  const result = await runVersionedMigrations(client, {
    log: (msg) => console.log(msg),
  });

  console.log(
    `[migrate] Success. ${result.appliedCount} migration(s) applied, ${result.alreadyAppliedCount} previously recorded.`,
  );
  await client.end();
  process.exit(0);
} catch (err) {
  console.error("[migrate] Fatal error executing migrations:", err);
  await client.end().catch(() => {});
  process.exit(1);
}
