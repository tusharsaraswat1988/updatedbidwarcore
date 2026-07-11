/**
 * Assemble diagnostics startup payload from existing boot-metrics snapshot (read-only).
 */

import type { BootMetricsSnapshot, SystemCMetrics, SystemDMetrics } from "@workspace/db/boot-metrics";
import { classifyEnvironment, type BidwarEnvironment } from "./classify-environment";
import { maskDatabaseUrl, type MaskedDatabaseIdentity } from "./mask-database-url";
import { resolveBuildInfo, type BuildInfo } from "./resolve-build-info";
import type { RuntimeDiagnostics } from "./collect-runtime-diagnostics";

export type StartupDiagnosticsPayload = {
  ok: true;
  capturedAt: string;
  environment: BidwarEnvironment;
  build: BuildInfo & { gitBranch: string | null };
  database: MaskedDatabaseIdentity;
  startup: {
    ready: boolean;
    reason?: string;
    systemC: SystemCMetrics | null;
    systemD: SystemDMetrics | null;
    totalDatabaseBootTimeMs: number | null;
    startupDdlBatches: number | null;
    startupFailures: number | null;
  };
  process: RuntimeDiagnostics["process"];
  memory: RuntimeDiagnostics["memory"];
  /** null when event-loop delay is not instrumented in-process. */
  eventLoopDelayMs: null;
  redis: RuntimeDiagnostics["redis"];
  sse: RuntimeDiagnostics["sse"];
  databaseConnection: RuntimeDiagnostics["databaseConnection"];
};

export type BuildStartupDiagnosticsInput = {
  snapshot: BootMetricsSnapshot;
  databaseUrl: string | undefined;
  runtime: RuntimeDiagnostics;
  appDomain?: string | null;
  appUrl?: string | null;
  nodeEnv?: string | null;
  bidwarEnv?: string | null;
  now?: Date;
};

export function buildStartupDiagnosticsPayload(
  input: BuildStartupDiagnosticsInput,
): StartupDiagnosticsPayload {
  const { snapshot, runtime } = input;
  const ready = snapshot.ready;

  let startupDdlBatches: number | null = null;
  let startupFailures: number | null = null;

  if (ready && snapshot.systemC && snapshot.systemD) {
    startupDdlBatches = snapshot.systemC.queryBatches + snapshot.systemD.queryCount;
    startupFailures =
      snapshot.systemC.failures + (snapshot.systemD.failure ? 1 : 0);
  }

  const build = resolveBuildInfo();

  return {
    ok: true,
    capturedAt: (input.now ?? new Date()).toISOString(),
    environment: classifyEnvironment({
      bidwarEnv: input.bidwarEnv ?? process.env.BIDWAR_ENV,
      nodeEnv: input.nodeEnv ?? process.env.NODE_ENV,
      appDomain: input.appDomain ?? process.env.APP_DOMAIN,
      appUrl: input.appUrl ?? process.env.APP_URL,
    }),
    build: {
      ...build,
      gitBranch: runtime.process.gitBranch,
    },
    database: maskDatabaseUrl(input.databaseUrl),
    startup: {
      ready,
      reason: ready ? undefined : "Boot metrics still settling",
      systemC: snapshot.systemC,
      systemD: snapshot.systemD,
      totalDatabaseBootTimeMs: snapshot.totalDatabaseBootTimeMs,
      startupDdlBatches,
      startupFailures,
    },
    process: runtime.process,
    memory: runtime.memory,
    eventLoopDelayMs: null,
    redis: runtime.redis,
    sse: runtime.sse,
    databaseConnection: runtime.databaseConnection,
  };
}
