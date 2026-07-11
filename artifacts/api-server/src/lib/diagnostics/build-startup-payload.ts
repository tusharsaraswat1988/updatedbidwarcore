/**
 * Assemble diagnostics startup payload from existing boot-metrics snapshot (read-only).
 */

import type { BootMetricsSnapshot, SystemCMetrics, SystemDMetrics } from "@workspace/db/boot-metrics";
import { classifyEnvironment, type BidwarEnvironment } from "./classify-environment";
import { maskDatabaseUrl, type MaskedDatabaseIdentity } from "./mask-database-url";
import { resolveBuildInfo, type BuildInfo } from "./resolve-build-info";

export type StartupDiagnosticsPayload = {
  ok: true;
  capturedAt: string;
  environment: BidwarEnvironment;
  build: BuildInfo;
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
  process: {
    uptimeSeconds: number;
    pid: number;
    nodeEnv: string;
  };
};

export type BuildStartupDiagnosticsInput = {
  snapshot: BootMetricsSnapshot;
  databaseUrl: string | undefined;
  appDomain?: string | null;
  appUrl?: string | null;
  nodeEnv?: string | null;
  bidwarEnv?: string | null;
  now?: Date;
};

export function buildStartupDiagnosticsPayload(
  input: BuildStartupDiagnosticsInput,
): StartupDiagnosticsPayload {
  const { snapshot } = input;
  const ready = snapshot.ready;

  let startupDdlBatches: number | null = null;
  let startupFailures: number | null = null;

  if (ready && snapshot.systemC && snapshot.systemD) {
    startupDdlBatches = snapshot.systemC.queryBatches + snapshot.systemD.queryCount;
    startupFailures =
      snapshot.systemC.failures + (snapshot.systemD.failure ? 1 : 0);
  }

  return {
    ok: true,
    capturedAt: (input.now ?? new Date()).toISOString(),
    environment: classifyEnvironment({
      bidwarEnv: input.bidwarEnv ?? process.env.BIDWAR_ENV,
      nodeEnv: input.nodeEnv ?? process.env.NODE_ENV,
      appDomain: input.appDomain ?? process.env.APP_DOMAIN,
      appUrl: input.appUrl ?? process.env.APP_URL,
    }),
    build: resolveBuildInfo(),
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
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
  };
}
