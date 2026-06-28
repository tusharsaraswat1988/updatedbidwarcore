import { logger } from "./logger";
import { getTotalSseClientCount } from "./broadcast";
import { getScoringTotalSseClientCount } from "./scoring-broadcast";
import { getBadmintonSseClientCount } from "./badminton-broadcast";

const MB = 1024 * 1024;
const RSS_WARN_BYTES = 400 * MB;
let timer: ReturnType<typeof setInterval> | null = null;

function toMb(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

export function startMemoryDiagnostics(): void {
  if (timer) return;
  timer = setInterval(() => {
    const usage = process.memoryUsage();
    const payload = {
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
    if (usage.rss > RSS_WARN_BYTES) {
      logger.warn(payload, "Memory diagnostics: RSS above 400MB");
    } else {
      logger.info(payload, "Memory diagnostics");
    }
  }, 60_000);
  timer.unref?.();
}
