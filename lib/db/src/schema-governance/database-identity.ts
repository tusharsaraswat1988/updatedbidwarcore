import { resolveDatabaseUrl } from "../database-url.js";

/**
 * Optional DATABASE_URL host allow-lists (infrastructure config, not code).
 *
 * Set on Render / local `.env` when you want an extra safety check beyond
 * BIDWAR_ENV + the DATABASE_URL Render already injects:
 *
 *   NEON_PRODUCTION_HOST_ALLOWLIST=substring,of,production,pooler,host
 *   NEON_STAGING_HOST_ALLOWLIST=substring,of,staging,pooler,host
 *
 * When unset, isolation host checks are skipped — environment selection is
 * driven only by BIDWAR_ENV / SCHEMA_AUTO_HEAL / APP_URL heuristics.
 */

function parseAllowList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveProductionHostAllowList(
  raw: string | undefined = process.env.NEON_PRODUCTION_HOST_ALLOWLIST,
): string[] {
  return parseAllowList(raw);
}

export function resolveStagingHostAllowList(
  raw: string | undefined = process.env.NEON_STAGING_HOST_ALLOWLIST,
): string[] {
  return parseAllowList(raw);
}

/** Extract hostname from a postgres connection string (no credentials returned). */
export function parseDatabaseHostname(databaseUrl: string): string | null {
  const trimmed = databaseUrl.trim();
  if (!trimmed) return null;
  try {
    const parseable = trimmed.replace(/^postgres(ql)?:\/\//i, "https://");
    const host = new URL(parseable).hostname.trim().toLowerCase();
    return host || null;
  } catch {
    const at = trimmed.lastIndexOf("@");
    if (at < 0) return null;
    const rest = trimmed.slice(at + 1);
    const hostPort = rest.split("/")[0] ?? "";
    const host = hostPort.split(":")[0]?.trim().toLowerCase();
    return host || null;
  }
}

function hostMatchesAllowList(hostname: string | null, allowList: string[]): boolean {
  if (!hostname || allowList.length === 0) return false;
  return allowList.some((marker) => hostname.includes(marker));
}

/** True when PRODUCTION allow-list is configured and DATABASE_URL host matches it. */
export function isProductionDatabaseUrl(
  databaseUrl: string,
  allowList: string[] = resolveProductionHostAllowList(),
): boolean {
  return hostMatchesAllowList(parseDatabaseHostname(databaseUrl), allowList);
}

/** True when STAGING allow-list is configured and DATABASE_URL host matches it. */
export function isStagingDatabaseUrl(
  databaseUrl: string,
  allowList: string[] = resolveStagingHostAllowList(),
): boolean {
  return hostMatchesAllowList(parseDatabaseHostname(databaseUrl), allowList);
}

export type DatabaseRole = "production" | "staging" | "other" | "unclassified";

/**
 * Classify DATABASE_URL using optional env allow-lists only.
 * With no allow-lists configured → `unclassified` (trust BIDWAR_ENV + Render URL).
 */
export function classifyDatabaseRole(databaseUrl: string): DatabaseRole {
  const productionAllow = resolveProductionHostAllowList();
  const stagingAllow = resolveStagingHostAllowList();
  if (productionAllow.length === 0 && stagingAllow.length === 0) {
    return "unclassified";
  }
  if (isProductionDatabaseUrl(databaseUrl, productionAllow)) return "production";
  if (isStagingDatabaseUrl(databaseUrl, stagingAllow)) return "staging";
  return "other";
}

/**
 * Optional fail-closed check when allow-lists are configured in env.
 * Does nothing when allow-lists are unset (BIDWAR_ENV + Render DATABASE_URL only).
 */
export function assertEnvironmentDatabaseIsolation(
  environment: string,
  databaseUrl: string = resolveDatabaseUrl(),
): void {
  const env = environment.trim().toLowerCase();
  const host = parseDatabaseHostname(databaseUrl) ?? "(unparseable)";
  const productionAllow = resolveProductionHostAllowList();
  const stagingAllow = resolveStagingHostAllowList();

  if (productionAllow.length === 0 && stagingAllow.length === 0) {
    return;
  }

  const matchesProduction = isProductionDatabaseUrl(databaseUrl, productionAllow);
  const matchesStaging = isStagingDatabaseUrl(databaseUrl, stagingAllow);

  const nonProdEnvs = new Set([
    "staging",
    "development",
    "dev",
    "local",
    "test",
  ]);

  if (nonProdEnvs.has(env) && matchesProduction) {
    throw new Error(
      `[schema] DATABASE_URL isolation breach: environment=${env} but host "${host}" ` +
        `matches NEON_PRODUCTION_HOST_ALLOWLIST. Fix DATABASE_URL to this environment's Neon database.`,
    );
  }

  if (env === "production" && matchesStaging) {
    throw new Error(
      `[schema] DATABASE_URL isolation breach: environment=production but host "${host}" ` +
        `matches NEON_STAGING_HOST_ALLOWLIST. Fix DATABASE_URL to the production Neon database.`,
    );
  }

  // Positive allow-list: when configured for this env, DATABASE_URL must match it.
  if (env === "production" && productionAllow.length > 0 && !matchesProduction) {
    throw new Error(
      `[schema] DATABASE_URL isolation breach: environment=production but host "${host}" ` +
        `is not on NEON_PRODUCTION_HOST_ALLOWLIST. Update DATABASE_URL or the allow-list.`,
    );
  }

  if (env === "staging" && stagingAllow.length > 0 && !matchesStaging) {
    throw new Error(
      `[schema] DATABASE_URL isolation breach: environment=staging but host "${host}" ` +
        `is not on NEON_STAGING_HOST_ALLOWLIST. Update DATABASE_URL or the allow-list.`,
    );
  }
}

/**
 * Never mutate a DB identified as production by NEON_PRODUCTION_HOST_ALLOWLIST.
 * When that allow-list is unset, heal is controlled only by BIDWAR_ENV / SCHEMA_AUTO_HEAL.
 */
export function gateAutoHealForDatabase(
  desiredAutoHeal: boolean,
  databaseUrl: string = resolveDatabaseUrl(),
): boolean {
  if (!desiredAutoHeal) return false;

  const productionAllow = resolveProductionHostAllowList();
  if (productionAllow.length === 0) return true;

  if (!isProductionDatabaseUrl(databaseUrl, productionAllow)) return true;

  const host = parseDatabaseHostname(databaseUrl) ?? "(unparseable)";
  console.error(
    `[schema] REFUSING auto-heal: DATABASE_URL host "${host}" matches NEON_PRODUCTION_HOST_ALLOWLIST. ` +
      `Forcing validate-only. Production schema changes must use versioned migrations.`,
  );
  return false;
}
