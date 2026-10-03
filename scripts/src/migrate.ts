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
import { resolveDirectDatabaseUrl } from "@workspace/db/database-url";
import { runVersionedMigrations } from "@workspace/db/migrator";

const env = loadAppEnv();
if (!env.loaded) {
  const hasDbUrl = Boolean(
    process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim(),
  );
  if (!hasDbUrl) {
    console.error(
      `[migrate] Missing ${env.file} at ${env.path} and no DATABASE_URL in process.env (NODE_ENV=${env.nodeEnv}).`,
    );
    process.exit(1);
  }
  console.log(
    `[migrate] No ${env.file} file at ${env.path} — using host-injected environment variables (NODE_ENV=${env.nodeEnv}).`,
  );
} else {
  console.log(`[migrate] using ${env.file} (${env.nodeEnv})`);
}

const { Client } = pg;

const client = new Client({
  connectionString: resolveDirectDatabaseUrl(),
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
