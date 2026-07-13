import type { DbQueryable } from "./timeouts.js";

export type LiveColumn = {
  table: string;
  column: string;
  dataType: string;
  isNullable: boolean;
};

export type LiveSchema = {
  tables: Set<string>;
  columns: Map<string, Set<string>>; // table -> column names
  indexes: Set<string>;
};

export async function introspectLiveSchema(db: DbQueryable): Promise<LiveSchema> {
  const tablesRes = await db.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const tables = new Set(tablesRes.rows.map((r) => r.table_name));

  const colsRes = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'`,
  );
  const columns = new Map<string, Set<string>>();
  for (const row of colsRes.rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
    columns.get(row.table_name)!.add(row.column_name);
  }

  const idxRes = await db.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const indexes = new Set(idxRes.rows.map((r) => r.indexname));

  return { tables, columns, indexes };
}

export async function readMigrationLedger(db: DbQueryable): Promise<{
  lastMigrationApplied: string | null;
  appliedLabels: string[];
}> {
  // Prefer drizzle ledger when present; fall back to none.
  try {
    const drizzle = await db.query<{ id: number; hash: string; created_at: string }>(
      `SELECT id, hash, created_at::text
       FROM drizzle.__drizzle_migrations
       ORDER BY created_at DESC
       LIMIT 20`,
    );
    if (drizzle.rows.length) {
      return {
        lastMigrationApplied: drizzle.rows[0]!.hash,
        appliedLabels: drizzle.rows.map((r) => r.hash),
      };
    }
  } catch {
    // table may not exist
  }

  try {
    const legacy = await db.query<{ hash: string }>(
      `SELECT hash FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 20`,
    );
    if (legacy.rows.length) {
      return {
        lastMigrationApplied: legacy.rows[0]!.hash,
        appliedLabels: legacy.rows.map((r) => r.hash),
      };
    }
  } catch {
    // ignore
  }

  return { lastMigrationApplied: null, appliedLabels: [] };
}
