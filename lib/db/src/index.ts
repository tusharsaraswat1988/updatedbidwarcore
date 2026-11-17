import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { resolveDatabaseUrl, resolveDirectDatabaseUrl } from "./database-url";
import { ensureCoreSchema } from "./ensure-schema";
import * as schema from "./schema";

const { Pool, Client } = pg;

export { pg, Pool, Client };
export { resolveDatabaseUrl, resolveDirectDatabaseUrl } from "./database-url";
export function createPgClient(connectionString?: string) {
  return new Client({
    connectionString: connectionString ?? resolveDirectDatabaseUrl(),
    connectionTimeoutMillis: 10_000,
  });
}

export { ensureCoreSchema } from "./ensure-schema";
export {
  buildSchemaContractFromDrizzle,
  getSchemaHealthReport,
  runSchemaGovernance,
  resolveAutoHealEnabled,
  resolveEffectiveAutoHeal,
  resolveEnvironment,
  formatDriftReportForConsole,
  assertEnvironmentDatabaseIsolation,
  classifyDatabaseRole,
  gateAutoHealForDatabase,
  isProductionDatabaseUrl,
  isStagingDatabaseUrl,
} from "./schema-governance/index.js";
export type { DriftReport, SchemaContract, DatabaseRole } from "./schema-governance/index.js";
export { getBootMetricsSnapshot } from "./boot-metrics";
export type { BootMetricsSnapshot, SystemCMetrics, SystemDMetrics } from "./boot-metrics";

/** Cap concurrent DB clients — multi-court scoring + lifecycle needs headroom. */
function resolvePoolMax(): number {
  const raw = Number.parseInt(process.env.PG_POOL_MAX ?? "20", 10);
  if (!Number.isFinite(raw)) return 20;
  return Math.min(50, Math.max(5, raw));
}

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  // Fail fast if a new connection can't be established in 20s (Neon cold start
  // can take up to ~15s; beyond that it's likely a connectivity problem).
  connectionTimeoutMillis: 30_000,
  // Release idle connections after 30s to avoid stale TCP issues on Neon.
  idleTimeoutMillis: 30_000,
  max: resolvePoolMax(),
});
export const db = drizzle(pool, { schema });

// Prevent unhandled idle client errors from crashing the Node.js process.
// Cloud databases (such as Neon) terminate idle sockets periodically.
pool.on("error", (err) => {
  console.warn("[db:pool] Unexpected error on idle client (pool will reconnect automatically):", err?.message || err);
});

// Keep Neon database alive with a lightweight ping every 4 minutes.
// Neon suspends the compute after ~5 minutes of inactivity, causing cold-start
// latency (5-60s) on the next query. This ping prevents the suspension.
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;
setInterval(() => {
  pool.query("SELECT 1").catch(() => {
    // Ignore errors — this is best-effort, the pool will reconnect automatically.
  });
}, KEEP_ALIVE_INTERVAL_MS);

export * from "./schema";
export * from "./member-auth";
export * from "./tournament-participation";
export * from "./member-sport-profiles";
export * from "./legacy-compatibility";
export * from "./runtime-context";
export * from "./migrator";
