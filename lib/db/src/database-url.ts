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
