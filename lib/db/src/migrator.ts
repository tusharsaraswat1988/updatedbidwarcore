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

const EMBEDDED_MIGRATIONS: Record<string, string> = {
  "0022_cricket_rule_presets.sql": `
    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS rule_preset_id integer;
    ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS rule_preset_id integer;

    CREATE TABLE IF NOT EXISTS cricket_rule_presets (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      variant_id text NOT NULL DEFAULT 'cricket.box',
      rule_profile_id text NOT NULL DEFAULT 'cricket.box.corporate_standard',
      rule_profile_version text NOT NULL DEFAULT '1.0.0',
      rule_overrides_json jsonb,
      squad_rules_json jsonb,
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ix_cricket_rule_presets_tournament_id
      ON cricket_rule_presets (tournament_id);
  `,
  "0023_cricket_broadcast_message_templates.sql": `
    CREATE TABLE IF NOT EXISTS cricket_broadcast_message_templates (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name text NOT NULL,
      details text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ix_cricket_broadcast_message_templates_tournament_id
      ON cricket_broadcast_message_templates (tournament_id);
  `,
};

function resolveMigrationsDirectory(explicit?: string): string | null {
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates: string[] = [
    path.resolve(process.cwd(), "lib/db/migrations"),
    "/app/lib/db/migrations",
    path.resolve(process.cwd(), "migrations"),
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = findRepoRoot(currentDir);
    candidates.unshift(path.resolve(repoRoot, "lib/db/migrations"));
  } catch {
    // ignore repoRoot walk error if run from single-bundle environment
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function runVersionedMigrations(
  client: pg.Client | pg.PoolClient,
  options: {
    log?: (msg: string) => void;
    migrationsDir?: string;
  } = {},
): Promise<MigrationResult> {
  const log = options.log ?? console.log;

  const migrationsDir = resolveMigrationsDirectory(options.migrationsDir);
  if (!migrationsDir) {
    log("[migrate] Migrations directory not found on disk — using embedded migrations.");
  } else {
    log(`[migrate] Using migrations directory at: ${migrationsDir}`);
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

  // 3. Read and sort all versioned migration files or fall back to embedded migrations
  const migrationItems: { file: string; sql: string }[] = [];

  if (migrationsDir) {
    try {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        migrationItems.push({
          file,
          sql: fs.readFileSync(path.join(migrationsDir, file), "utf8"),
        });
      }
    } catch (readErr) {
      log(`[migrate] Warning reading migrations directory: ${readErr}`);
    }
  }

  // Ensure embedded migrations are always present as fallback
  for (const [file, sql] of Object.entries(EMBEDDED_MIGRATIONS)) {
    if (!migrationItems.some((item) => item.file === file)) {
      migrationItems.push({ file, sql });
    }
  }

  migrationItems.sort((a, b) => a.file.localeCompare(b.file));

  const appliedFiles: string[] = [];
  let alreadyAppliedCount = 0;

  for (const item of migrationItems) {
    const { file, sql } = item;
    const fileBase = file.replace(/\.sql$/, "");
    const isApplied = appliedSet.has(file) || appliedSet.has(fileBase);

    if (isApplied) {
      alreadyAppliedCount++;
      continue;
    }

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
    `[migrate] complete. Total: ${migrationItems.length}, Newly applied: ${appliedFiles.length}, Already up-to-date: ${alreadyAppliedCount}`,
  );

  return {
    totalMigrations: migrationItems.length,
    appliedCount: appliedFiles.length,
    alreadyAppliedCount,
    appliedFiles,
  };
}
