/**
 * Collect runtime diagnostics from in-process state only.
 * No database queries. No Redis ping. No auction logic changes.
 */

import type { Pool } from "pg";
import { getTotalSseClientCount } from "../broadcast.js";
import { getScoringTotalSseClientCount } from "../scoring-broadcast.js";
import { getBadmintonSseClientCount } from "../badminton-broadcast.js";
import { getRedisDiagnosticsStatus } from "../redis.js";

export type RuntimeDiagnostics = {
  process: {
    serverStartTime: string;
    uptimeSeconds: number;
    uptimeHuman: string;
    pid: number;
    nodeVersion: string;
    nodeEnv: string;
    gitBranch: string | null;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  /** Omitted when not instrumented in-process. */
  eventLoopDelayMs: null;
  redis: ReturnType<typeof getRedisDiagnosticsStatus>;
  sse: {
    status: "active" | "idle";
    auctionClients: number;
    scoringClients: number;
    badmintonClients: number;
    totalClients: number;
  };
  databaseConnection: {
    status: "pool_active" | "pool_idle" | "pool_waiting" | "unknown";
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
};

function toMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (mins || hours || days) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function resolveGitBranch(): string | null {
  return (
    process.env.BIDWAR_GIT_BRANCH?.trim() ||
    process.env.RENDER_GIT_BRANCH?.trim() ||
    process.env.GIT_BRANCH?.trim() ||
    null
  );
}

function databaseConnectionFromPool(pool: Pool | null | undefined): RuntimeDiagnostics["databaseConnection"] {
  if (!pool) {
    return {
      status: "unknown",
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };
  }

  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  const waitingCount = pool.waitingCount;

  let status: RuntimeDiagnostics["databaseConnection"]["status"] = "unknown";
  if (waitingCount > 0) status = "pool_waiting";
  else if (totalCount > 0 && idleCount === totalCount) status = "pool_idle";
  else if (totalCount > 0) status = "pool_active";
  else status = "pool_idle";

  return { status, totalCount, idleCount, waitingCount };
}

export function collectRuntimeDiagnostics(pool?: Pool | null): RuntimeDiagnostics {
  const uptimeSeconds = process.uptime();
  const serverStartMs = Date.now() - uptimeSeconds * 1000;
  const usage = process.memoryUsage();

  const auctionClients = getTotalSseClientCount();
  const scoringClients = getScoringTotalSseClientCount();
  const badmintonClients = getBadmintonSseClientCount();
  const totalClients = auctionClients + scoringClients + badmintonClients;

  return {
    process: {
      serverStartTime: new Date(serverStartMs).toISOString(),
      uptimeSeconds: Math.floor(uptimeSeconds),
      uptimeHuman: formatUptime(uptimeSeconds),
      pid: process.pid,
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      gitBranch: resolveGitBranch(),
    },
    memory: {
      rssBytes: usage.rss,
      heapUsedBytes: usage.heapUsed,
      heapTotalBytes: usage.heapTotal,
      rssMb: toMb(usage.rss),
      heapUsedMb: toMb(usage.heapUsed),
      heapTotalMb: toMb(usage.heapTotal),
    },
    eventLoopDelayMs: null,
    redis: getRedisDiagnosticsStatus(),
    sse: {
      status: totalClients > 0 ? "active" : "idle",
      auctionClients,
      scoringClients,
      badmintonClients,
      totalClients,
    },
    databaseConnection: databaseConnectionFromPool(pool ?? null),
  };
}
