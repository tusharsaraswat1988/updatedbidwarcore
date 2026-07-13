import type pg from "pg";
import type { DriftReport } from "./types.js";

/** Apply only idempotent additive SQL. Skips comments / guidance lines. */
export async function applyIdempotentHeal(
  pool: pg.Pool,
  report: DriftReport,
  log: (msg: string, extra?: Record<string, unknown>) => void,
): Promise<{ applied: string[]; failed: Array<{ sql: string; error: string }> }> {
  const applied: string[] = [];
  const failed: Array<{ sql: string; error: string }> = [];

  for (const sql of report.requiredSql) {
    const trimmed = sql.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;
    // Hard guard: never destructive
    if (/\b(DROP|RENAME|TRUNCATE|DELETE FROM|ALTER\s+TYPE\s+\w+\s+RENAME)\b/i.test(trimmed)) {
      failed.push({ sql: trimmed, error: "Refusing destructive SQL in healer" });
      continue;
    }
    if (
      !/^(CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS|ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS|CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS)/i.test(
        trimmed,
      )
    ) {
      failed.push({ sql: trimmed, error: "SQL not in allow-list for auto-heal" });
      continue;
    }

    try {
      await pool.query(trimmed);
      applied.push(trimmed);
      log("[schema-governance] healed", { sql: trimmed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ sql: trimmed, error: message });
      log("[schema-governance] heal failed", { sql: trimmed, error: message });
    }
  }

  return { applied, failed };
}
