import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { resolveDatabaseUrl } from "./database-url";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });
export const db = drizzle(pool, { schema });

/** Idempotent column adds so new fields persist without a manual migrate step. */
void pool
  .query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_url text`)
  .catch((err) => {
    console.error("[db] failed to ensure teams.owner_photo_url column:", err);
  });

void pool
  .query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS email text`)
  .catch((err) => {
    console.error("[db] failed to ensure players.email column:", err);
  });

void pool
  .query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email text`)
  .catch((err) => {
    console.error("[db] failed to ensure teams.owner_email column:", err);
  });

export * from "./schema";
