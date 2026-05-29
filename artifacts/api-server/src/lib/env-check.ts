import { logger } from "./logger";

/**
 * Validates required environment variables at startup.
 * Logs a clear error for every missing variable and exits if any are missing.
 * Called once from index.ts before the server starts listening.
 */
export function checkRequiredEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  let fatal = false;

  if (!process.env.NEON_DATABASE_URL && !process.env.DATABASE_URL) {
    logger.error(
      "Missing env var: NEON_DATABASE_URL or DATABASE_URL " +
        "(set your PostgreSQL connection string)",
    );
    fatal = true;
  }

  if (!process.env.ADMIN_PASSWORD) {
    logger.error("Missing env var: ADMIN_PASSWORD");
    fatal = true;
  }

  if (isProd && !process.env.SESSION_SECRET) {
    logger.error(
      "Missing env var: SESSION_SECRET " +
        "(required in production — generate with: openssl rand -hex 32)",
    );
    fatal = true;
  }

  if (fatal) {
    process.exit(1);
  }
}
