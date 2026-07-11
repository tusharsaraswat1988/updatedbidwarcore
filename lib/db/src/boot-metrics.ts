/**
 * Database boot observability for Systems C and D.
 * Metrics and summary logging only — does not alter SQL or schema behaviour.
 */

export type SystemCMetrics = {
  executionTimeMs: number;
  createStatements: number;
  alterStatements: number;
  createIndexStatements: number;
  dropStatements: number;
  dmlStatements: number;
  queryBatches: number;
  failures: number;
};

export type SystemDMetrics = {
  executionTimeMs: number;
  queryCount: number;
  success: boolean;
  failure: boolean;
  errorMessage?: string;
};

type StatementCounts = {
  createStatements: number;
  alterStatements: number;
  createIndexStatements: number;
  dropStatements: number;
  dmlStatements: number;
};

const emptyCounts = (): StatementCounts => ({
  createStatements: 0,
  alterStatements: 0,
  createIndexStatements: 0,
  dropStatements: 0,
  dmlStatements: 0,
});

/** Classify statements inside a SQL batch (idempotent heuristics for metrics only). */
export function classifySqlStatements(sql: string): StatementCounts {
  const counts = emptyCounts();
  counts.createStatements = (sql.match(/\bCREATE\s+TABLE\b/gi) ?? []).length;
  counts.createIndexStatements = (sql.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi) ?? []).length;
  counts.alterStatements = (sql.match(/\bALTER\s+TABLE\b/gi) ?? []).length;
  counts.dropStatements = (sql.match(/\bDROP\s+(?:TABLE|INDEX|COLUMN)\b/gi) ?? []).length;
  counts.dmlStatements = (sql.match(/\b(?:UPDATE|INSERT|DELETE)\b/gi) ?? []).length;
  return counts;
}

function addCounts(target: StatementCounts, next: StatementCounts): void {
  target.createStatements += next.createStatements;
  target.alterStatements += next.alterStatements;
  target.createIndexStatements += next.createIndexStatements;
  target.dropStatements += next.dropStatements;
  target.dmlStatements += next.dmlStatements;
}

const systemCCounts = emptyCounts();
const systemCPending: Promise<unknown>[] = [];
let systemCStartedAt: number | null = null;
let systemCQueryBatches = 0;
let systemCFailures = 0;
let systemCMetrics: SystemCMetrics | null = null;
let systemCSettled = false;

let systemCResolveSettled!: () => void;
const systemCSettledPromise = new Promise<void>((resolve) => {
  systemCResolveSettled = resolve;
});

let systemDMetrics: SystemDMetrics | null = null;
let summaryPrinted = false;
const bootStartedAt = Date.now();

/**
 * Observe a System C pool.query without changing SQL or error handling.
 * Callers keep `.catch(...)` exactly as before.
 */
export function observeSystemCQuery<T>(sql: string, run: () => Promise<T>): Promise<T> {
  if (systemCStartedAt === null) {
    systemCStartedAt = Date.now();
  }
  systemCQueryBatches += 1;
  addCounts(systemCCounts, classifySqlStatements(sql));
  const promise = run();
  systemCPending.push(
    promise.then(
      () => undefined,
      () => {
        systemCFailures += 1;
      },
    ),
  );
  return promise;
}

/** Call once after all System C void queries have been registered. */
export function finalizeSystemCTracking(): void {
  const startedAt = systemCStartedAt ?? Date.now();
  void Promise.allSettled(systemCPending).then(() => {
    systemCMetrics = {
      executionTimeMs: Date.now() - startedAt,
      createStatements: systemCCounts.createStatements,
      alterStatements: systemCCounts.alterStatements,
      createIndexStatements: systemCCounts.createIndexStatements,
      dropStatements: systemCCounts.dropStatements,
      dmlStatements: systemCCounts.dmlStatements,
      queryBatches: systemCQueryBatches,
      failures: systemCFailures,
    };
    systemCSettled = true;
    systemCResolveSettled();
    tryPrintDatabaseStartupSummary();
  });
}

export function recordSystemDMetrics(metrics: SystemDMetrics): void {
  systemDMetrics = metrics;
  tryPrintDatabaseStartupSummary();
}

function ddlStatementTotal(c: SystemCMetrics): number {
  return (
    c.createStatements +
    c.alterStatements +
    c.createIndexStatements +
    c.dropStatements
  );
}

function formatStartupSummary(c: SystemCMetrics, d: SystemDMetrics, totalMs: number): string {
  return [
    "=========================================",
    "DATABASE STARTUP SUMMARY",
    "=========================================",
    "System C",
    `Execution Time: ${c.executionTimeMs}ms`,
    `DDL Statements: ${ddlStatementTotal(c)} (CREATE ${c.createStatements}, ALTER ${c.alterStatements}, CREATE INDEX ${c.createIndexStatements}, DROP ${c.dropStatements})`,
    `DML Statements: ${c.dmlStatements}`,
    "System D",
    `Execution Time: ${d.executionTimeMs}ms`,
    `Queries: ${d.queryCount}`,
    `Success: ${d.success}`,
    `Failure: ${d.failure}`,
    `Total Database Boot Time: ${totalMs}ms`,
    "=========================================",
  ].join("\n");
}

function tryPrintDatabaseStartupSummary(): void {
  if (summaryPrinted || !systemCMetrics || !systemDMetrics) {
    return;
  }
  summaryPrinted = true;

  const totalMs = Date.now() - bootStartedAt;
  const text = formatStartupSummary(systemCMetrics, systemDMetrics, totalMs);
  const payload = {
    event: "database_startup_summary",
    systemC: systemCMetrics,
    systemD: systemDMetrics,
    totalDatabaseBootTimeMs: totalMs,
  };

  // One human-readable block + one structured JSON line. No per-query logs.
  console.log(text);
  console.log(JSON.stringify(payload));
}

/** Optional await for tests; does not block API listen path. */
export async function waitForDatabaseStartupSummary(): Promise<void> {
  await systemCSettledPromise;
  tryPrintDatabaseStartupSummary();
}

export function getBootMetricsSnapshot(): {
  systemC: SystemCMetrics | null;
  systemD: SystemDMetrics | null;
  systemCSettled: boolean;
  summaryPrinted: boolean;
} {
  return {
    systemC: systemCMetrics,
    systemD: systemDMetrics,
    systemCSettled,
    summaryPrinted,
  };
}
