import { resolveDatabaseUrl } from "../database-url.js";

/**
 * Neon project / pooler host markers for BidWar environments.
 * Host fingerprints only (no credentials). Override via env if Neon endpoints change.
 *
 * Source of truth (ops verified): STAGING_CERTIFICATION_REPORT.md
 * - Production project jolly-tree-42208228 → ep-late-math-aohd4iep
 * - Staging project old-art-20161659 → ep-long-sky-aorboyzr
 */
export const DEFAULT_PRODUCTION_DB_HOST_MARKERS = [
  "ep-late-math-aohd4iep",
  "jolly-tree-42208228",
] as const;

export const DEFAULT_STAGING_DB_HOST_MARKERS = [
  "ep-long-sky-aorboyzr",
  "old-art-20161659",
] as const;

function parseMarkerList(
  raw: string | undefined,
  defaults: readonly string[],
): string[] {
  if (!raw?.trim()) return [...defaults];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveProductionDbHostMarkers(
  raw: string | undefined = process.env.NEON_PRODUCTION_HOST_MARKERS,
): string[] {
  return parseMarkerList(raw, DEFAULT_PRODUCTION_DB_HOST_MARKERS);
}

export function resolveStagingDbHostMarkers(
  raw: string | undefined = process.env.NEON_STAGING_HOST_MARKERS,
): string[] {
  return parseMarkerList(raw, DEFAULT_STAGING_DB_HOST_MARKERS);
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
    // Fallback for unusual URLs: user:pass@host:port/db
    const at = trimmed.lastIndexOf("@");
    if (at < 0) return null;
    const rest = trimmed.slice(at + 1);
    const hostPort = rest.split("/")[0] ?? "";
    const host = hostPort.split(":")[0]?.trim().toLowerCase();
    return host || null;
  }
}

function hostMatchesMarkers(hostname: string | null, markers: string[]): boolean {
  if (!hostname) return false;
  return markers.some((marker) => hostname.includes(marker));
}

export function isProductionDatabaseUrl(
  databaseUrl: string,
  markers: string[] = resolveProductionDbHostMarkers(),
): boolean {
  return hostMatchesMarkers(parseDatabaseHostname(databaseUrl), markers);
}

export function isStagingDatabaseUrl(
  databaseUrl: string,
  markers: string[] = resolveStagingDbHostMarkers(),
): boolean {
  return hostMatchesMarkers(parseDatabaseHostname(databaseUrl), markers);
}

export type DatabaseRole = "production" | "staging" | "other";

export function classifyDatabaseRole(databaseUrl: string): DatabaseRole {
  if (isProductionDatabaseUrl(databaseUrl)) return "production";
  if (isStagingDatabaseUrl(databaseUrl)) return "staging";
  return "other";
}

/**
 * Fail closed when app environment and Neon endpoint disagree.
 * Prevents staging/local from using production DATABASE_URL (and the reverse).
 */
export function assertEnvironmentDatabaseIsolation(
  environment: string,
  databaseUrl: string = resolveDatabaseUrl(),
): void {
  const env = environment.trim().toLowerCase();
  const role = classifyDatabaseRole(databaseUrl);
  const host = parseDatabaseHostname(databaseUrl) ?? "(unparseable)";

  const nonProdEnvs = new Set([
    "staging",
    "development",
    "dev",
    "local",
    "test",
  ]);

  if (nonProdEnvs.has(env) && role === "production") {
    throw new Error(
      `[schema] DATABASE_URL isolation breach: environment=${env} but connection host ` +
        `"${host}" matches production Neon. Auto-heal and boot mutations are blocked. ` +
        `Fix the Render/local DATABASE_URL to the ${env} Neon project/branch ` +
        `(not production jolly-tree / ep-late-math-aohd4iep).`,
    );
  }

  if (env === "production" && role === "staging") {
    throw new Error(
      `[schema] DATABASE_URL isolation breach: environment=production but connection host ` +
        `"${host}" matches staging Neon. Fix the production Render DATABASE_URL to the ` +
        `production Neon project (jolly-tree / ep-late-math-aohd4iep), not staging.`,
    );
  }
}

/**
 * Hard gate: never mutate production Neon via schema auto-heal / boot DDL.
 * Returns false (validate-only) when DATABASE_URL is production, even if
 * SCHEMA_AUTO_HEAL=true was set by mistake.
 */
export function gateAutoHealForDatabase(
  desiredAutoHeal: boolean,
  databaseUrl: string = resolveDatabaseUrl(),
): boolean {
  if (!desiredAutoHeal) return false;
  if (!isProductionDatabaseUrl(databaseUrl)) return true;

  const host = parseDatabaseHostname(databaseUrl) ?? "(unparseable)";
  console.error(
    `[schema] REFUSING auto-heal: DATABASE_URL host "${host}" is production Neon. ` +
      `Forcing validate-only. Production schema changes must use versioned migrations.`,
  );
  return false;
}
