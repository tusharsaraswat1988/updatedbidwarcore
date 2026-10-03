/**
 * Resolves the PostgreSQL connection string from environment variables.
 * NEON_DATABASE_URL takes priority over DATABASE_URL (Replit / Neon convention).
 */
export function resolveDatabaseUrl(): string {
  const url =
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Database connection string required. " +
        "Set DATABASE_URL or NEON_DATABASE_URL to your PostgreSQL connection string.",
    );
  }

  return url;
}

/**
 * Resolves the direct (unpooled) PostgreSQL connection string specifically
 * for long-lived LISTEN / NOTIFY listeners and DDL migration clients.
 *
 * Transaction poolers (such as Neon PgBouncer endpoints with `-pooler`)
 * break PostgreSQL `LISTEN` semantics because transactions do not hold
 * a permanent backend connection.
 */
export function resolveDirectDatabaseUrl(): string {
  const directOverride =
    process.env.DIRECT_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();
  if (directOverride) {
    return directOverride;
  }

  const base = resolveDatabaseUrl();
  // If connection string points to a Neon pooled endpoint, strip '-pooler.' to target direct compute
  if (base.includes("-pooler.")) {
    return base.replace("-pooler.", ".");
  }
  return base;
}

