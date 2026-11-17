import type pg from "pg";
import { recordSystemDMetrics } from "./boot-metrics";
import { resolveDatabaseUrl } from "./database-url";
import {
  resolveEnvironment,
  runSchemaGovernance,
} from "./schema-governance/index.js";
import {
  assertEnvironmentDatabaseIsolation,
  classifyDatabaseRole,
} from "./schema-governance/database-identity.js";
import {
  resolveSchemaBootTimeoutMs,
  withTimeout,
} from "./schema-governance/timeouts.js";

/**
 * Boot schema orchestration — Milestone 2: Read-Only Schema Validation.
 *
 * Server bootstrap performs strictly a fast, read-only validation check that confirms
 * schema readiness against Drizzle SSOT without executing runtime ALTER TABLE or CREATE TABLE queries.
 * Database DDL migrations are decoupled and executed prior to boot via `pnpm run migrate:prod`.
 *
 * Never bind PORT before this completes successfully.
 */
export async function ensureCoreSchema(pool: pg.Pool): Promise<void> {
  const timeoutMs = resolveSchemaBootTimeoutMs();
  const startedAt = Date.now();

  await withTimeout(
    runEnsureCoreSchemaWithClient(pool),
    timeoutMs,
    `[schema] bootstrap validation timed out after ${timeoutMs}ms. ` +
      `Check DATABASE_URL / Neon wake, lock contention, and SCHEMA_BOOT_TIMEOUT_MS. ` +
      `Refusing to start HTTP server.`,
  );

  console.info(`[schema] bootstrap validation finished in ${Date.now() - startedAt}ms`);
}

async function runEnsureCoreSchemaWithClient(pool: pg.Pool): Promise<void> {
  const startedAt = Date.now();
  const databaseUrl = resolveDatabaseUrl();
  const environment = resolveEnvironment();
  assertEnvironmentDatabaseIsolation(environment, databaseUrl);

  console.info("[schema] boot policy", {
    environment,
    databaseRole: classifyDatabaseRole(databaseUrl),
    mode: "read-only-validation",
    autoHealEnabled: false,
  });

  const connectTimeoutMs = pool.options.connectionTimeoutMillis || 20_000;
  const client = await withTimeout(
    pool.connect(),
    connectTimeoutMs + 1_000,
    `[schema] timed out acquiring a DB connection after ${connectTimeoutMs}ms. Refusing to start HTTP server.`,
  );

  let success = false;
  let errorMessage: string | undefined;

  try {
    await client.query(`SET lock_timeout = '15s'`);
    await client.query(`SET statement_timeout = '30s'`);

    // Strictly read-only validation: diffs live PostgreSQL catalog against Drizzle TypeScript schema.
    // Throws if critical schema drift is detected (refusing to start unmigrated servers).
    await runSchemaGovernance(client, {
      autoHeal: false,
      environment,
      databaseUrl,
      log: (msg, extra) => {
        if (extra) console.info(msg, extra);
        else console.info(msg);
      },
    });

    success = true;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    try {
      await client.query("RESET lock_timeout");
      await client.query("RESET statement_timeout");
    } catch {
      // ignore — connection may already be broken
    }
    client.release();

    recordSystemDMetrics({
      executionTimeMs: Date.now() - startedAt,
      queryCount: 0,
      success,
      failure: !success,
      errorMessage,
    });
  }
}
