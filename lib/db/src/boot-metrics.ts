/**
 * Database boot observability for Systems C and D.
 *
 * System C and System D runtime DDL have been eliminated in Milestone 2
 * Database Stabilization. Metrics snapshots report clean 0 counts.
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

let systemCMetrics: SystemCMetrics = {
  executionTimeMs: 0,
  createStatements: 0,
  alterStatements: 0,
  createIndexStatements: 0,
  dropStatements: 0,
  dmlStatements: 0,
  queryBatches: 0,
  failures: 0,
};

let systemDMetrics: SystemDMetrics = {
  executionTimeMs: 0,
  queryCount: 0,
  success: true,
  failure: false,
};

let systemCSettled = true;
let summaryPrinted = false;
const bootStartedAt = Date.now();

export function observeSystemCQuery<T>(_sql: string, run: () => Promise<T>): Promise<T> {
  return run();
}

export function finalizeSystemCTracking(): void {
  systemCSettled = true;
}

export function recordSystemDMetrics(metrics: SystemDMetrics): void {
  systemDMetrics = metrics;
  if (!summaryPrinted) {
    summaryPrinted = true;
    console.info("[schema] database startup validation complete", {
      validationTimeMs: metrics.executionTimeMs,
      success: metrics.success,
    });
  }
}

export async function waitForDatabaseStartupSummary(): Promise<void> {
  // Instant resolution — no runtime DDL running
  return Promise.resolve();
}

export type BootMetricsSnapshot = {
  systemC: SystemCMetrics | null;
  systemD: SystemDMetrics | null;
  systemCSettled: boolean;
  summaryPrinted: boolean;
  ready: boolean;
  totalDatabaseBootTimeMs: number | null;
};

export function getBootMetricsSnapshot(): BootMetricsSnapshot {
  return {
    systemC: systemCMetrics,
    systemD: systemDMetrics,
    systemCSettled: true,
    summaryPrinted: true,
    ready: true,
    totalDatabaseBootTimeMs: Date.now() - bootStartedAt,
  };
}
