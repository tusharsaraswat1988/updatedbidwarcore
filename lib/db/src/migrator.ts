import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { findRepoRoot } from "./repo-root.js";

export type MigrationResult = {
  totalMigrations: number;
  appliedCount: number;
  alreadyAppliedCount: number;
  appliedFiles: string[];
};

export async function runVersionedMigrations(
  client: pg.Client | pg.PoolClient,
  options: {
    log?: (msg: string) => void;
    migrationsDir?: string;
  } = {},
): Promise<MigrationResult> {
  const log = options.log ?? console.log;

  const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
  const migrationsDir =
    options.migrationsDir ?? path.resolve(repoRoot, "lib/db/migrations");

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(
      `[migrate] Migrations directory not found at: ${migrationsDir}`,
    );
  }

  // 1. Ensure migration ledger tables exist in both drizzle schema and public schema
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Fetch all applied migration hashes
  const drizzleRows = await client.query<{ hash: string }>(
    `SELECT hash FROM drizzle.__drizzle_migrations`,
  );
  const publicRows = await client.query<{ hash: string }>(
    `SELECT hash FROM __drizzle_migrations`,
  );

  const appliedSet = new Set<string>();
  for (const r of drizzleRows.rows) appliedSet.add(r.hash);
  for (const r of publicRows.rows) appliedSet.add(r.hash);

  // 3. Read and sort all versioned migration files
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedFiles: string[] = [];
  let alreadyAppliedCount = 0;

  for (const file of files) {
    const fileBase = file.replace(/\.sql$/, "");
    const isApplied = appliedSet.has(file) || appliedSet.has(fileBase);

    if (isApplied) {
      alreadyAppliedCount++;
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING`,
        [file],
      );
      await client.query(
        `INSERT INTO __drizzle_migrations (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING`,
        [file],
      );
      await client.query("COMMIT");

      log(`[migrate] applied: ${file}`);
      appliedFiles.push(file);
      appliedSet.add(file);
      appliedSet.add(fileBase);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`[migrate] FAILED on ${file}:`, err);
      throw new Error(
        `Migration failed on ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  log(
    `[migrate] complete. Total: ${files.length}, Newly applied: ${appliedFiles.length}, Already up-to-date: ${alreadyAppliedCount}`,
  );

  return {
    totalMigrations: files.length,
    appliedCount: appliedFiles.length,
    alreadyAppliedCount,
    appliedFiles,
  };
}
