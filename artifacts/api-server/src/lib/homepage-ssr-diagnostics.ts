import { logger } from "./logger.js";

const COMPONENT = "homepage-ssr";

export type HomepageSsrSuccessMetrics = {
  cacheHit: boolean;
  cacheLoadMs: number;
  renderMs: number;
  payloadBytes: number;
  dehydratedBytes: number;
  htmlBytes: number;
  totalMs: number;
};

export type HomepageSsrFailureMetrics = {
  cacheHit: boolean;
  phase: "data" | "render" | "compose";
  totalMs: number;
  err: unknown;
};

export function measureJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

export function logHomepageCacheHit(): void {
  logger.info({ component: COMPONENT, event: "homepage_cache_hit" });
}

export function logHomepageCacheMiss(): void {
  logger.info({ component: COMPONENT, event: "homepage_cache_miss" });
}

export function logHomepageSsrSuccess(metrics: HomepageSsrSuccessMetrics): void {
  logger.info({ component: COMPONENT, event: "homepage_ssr_success", ...metrics });
}

export function logHomepageSsrFailure(metrics: HomepageSsrFailureMetrics): void {
  logger.error({ component: COMPONENT, event: "homepage_ssr_failure", ...metrics });
}
