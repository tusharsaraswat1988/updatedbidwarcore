import { logger } from "./logger";
import { getTotalSseClientCount } from "./broadcast";
import { getScoringTotalSseClientCount } from "./scoring-broadcast";
import { getBadmintonSseClientCount } from "./badminton-broadcast";

const MB = 1024 * 1024;
export const RSS_WARN_MB = 350;
const RSS_WARN_BYTES = RSS_WARN_MB * MB;
const DEV_LOG_INTERVAL_MS = 60_000;
const PROD_CHECK_INTERVAL_MS = 60_000;
const PROD_HEARTBEAT_MS = 10 * 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

function toMb(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function buildPayload(usage: NodeJS.MemoryUsage) {
  return {
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    externalMb: toMb(usage.external),
    arrayBuffersMb: toMb(usage.arrayBuffers),
    sseConnections: {
      auction: getTotalSseClientCount(),
      scoring: getScoringTotalSseClientCount(),
      badminton: getBadmintonSseClientCount(),
      total: getTotalSseClientCount() + getScoringTotalSseClientCount() + getBadmintonSseClientCount(),
    },
  };
}

export type MemoryDiagnosticLogDecision = {
  shouldLog: boolean;
  level: "info" | "warn";
  message: string;
  nextHeartbeatMs: number;
};

/** Pure helper — production logs on high RSS or 10-minute heartbeat; dev logs every tick. */
export function resolveMemoryDiagnosticLog(options: {
  isProduction: boolean;
  rssBytes: number;
  nowMs: number;
  lastHeartbeatMs: number;
}): MemoryDiagnosticLogDecision {
  const { isProduction, rssBytes, nowMs, lastHeartbeatMs } = options;
  const rssHigh = rssBytes > RSS_WARN_BYTES;

  if (!isProduction) {
    return {
      shouldLog: true,
      level: rssHigh ? "warn" : "info",
      message: rssHigh
        ? `Memory diagnostics: RSS above ${RSS_WARN_MB}MB`
        : "Memory diagnostics",
      nextHeartbeatMs: lastHeartbeatMs,
    };
  }

  if (rssHigh) {
    return {
      shouldLog: true,
      level: "warn",
      message: `Memory diagnostics: RSS above ${RSS_WARN_MB}MB`,
      nextHeartbeatMs: nowMs,
    };
  }

  const heartbeatDue = nowMs - lastHeartbeatMs >= PROD_HEARTBEAT_MS;
  if (heartbeatDue) {
    return {
      shouldLog: true,
      level: "info",
      message: "Memory diagnostics heartbeat",
      nextHeartbeatMs: nowMs,
    };
  }

  return {
    shouldLog: false,
    level: "info",
    message: "",
    nextHeartbeatMs: lastHeartbeatMs,
  };
}

export function startMemoryDiagnostics(): void {
  if (timer) return;

  const isProduction = isProductionEnv();
  let lastHeartbeatMs = Date.now();

  timer = setInterval(() => {
    const usage = process.memoryUsage();
    const decision = resolveMemoryDiagnosticLog({
      isProduction,
      rssBytes: usage.rss,
      nowMs: Date.now(),
      lastHeartbeatMs,
    });

    if (!decision.shouldLog) return;

    lastHeartbeatMs = decision.nextHeartbeatMs;
    const payload = buildPayload(usage);
    if (decision.level === "warn") {
      logger.warn(payload, decision.message);
    } else {
      logger.info(payload, decision.message);
    }
  }, isProduction ? PROD_CHECK_INTERVAL_MS : DEV_LOG_INTERVAL_MS);

  timer.unref?.();
}
