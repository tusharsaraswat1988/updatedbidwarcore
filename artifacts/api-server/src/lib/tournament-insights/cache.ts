import { getRedisCommandClient } from "../redis";
import {
  buildTournamentInsightsSummary,
  isLiveAuctionSummary,
} from "./build-summary";
import { generateTournamentInsights } from "./generate-insights";
import type { TournamentInsightsResponse } from "./types";

const LIVE_TTL_MS = 75_000;
const IDLE_TTL_MS = 10 * 60_000;
const REDIS_PREFIX = "tournament-insights:";

type CacheEntry = { expires: number; value: TournamentInsightsResponse };

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<TournamentInsightsResponse>>();

function cacheKey(tournamentId: number): string {
  return String(tournamentId);
}

function ttlForSummary(isLive: boolean): number {
  return isLive ? LIVE_TTL_MS : IDLE_TTL_MS;
}

async function fetchInsights(tournamentId: number): Promise<{
  response: TournamentInsightsResponse;
  isLive: boolean;
}> {
  const summary = await buildTournamentInsightsSummary(tournamentId);
  if (!summary) {
    return {
      isLive: false,
      response: {
        insights: [],
        generatedAt: new Date().toISOString(),
        cacheTtlSeconds: Math.ceil(IDLE_TTL_MS / 1000),
        source: "template",
      },
    };
  }

  const isLive = isLiveAuctionSummary(summary);
  const { insights, source } = await generateTournamentInsights(summary);
  const ttlMs = ttlForSummary(isLive);

  return {
    isLive,
    response: {
      insights,
      generatedAt: new Date().toISOString(),
      cacheTtlSeconds: Math.ceil(ttlMs / 1000),
      source,
    },
  };
}

export async function getTournamentInsights(
  tournamentId: number,
): Promise<TournamentInsightsResponse> {
  const key = cacheKey(tournamentId);
  const now = Date.now();

  const memHit = memory.get(key);
  if (memHit && memHit.expires > now) {
    return memHit.value;
  }

  const redis = getRedisCommandClient();
  if (redis) {
    try {
      const raw = await redis.get(`${REDIS_PREFIX}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as TournamentInsightsResponse;
        const ttlMs = (parsed.cacheTtlSeconds ?? 75) * 1000;
        memory.set(key, { expires: now + ttlMs, value: parsed });
        return parsed;
      }
    } catch {
      // Fall through
    }
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const { response: value, isLive } = await fetchInsights(tournamentId);
      const ttlMs = ttlForSummary(isLive);

      memory.set(key, { expires: Date.now() + ttlMs, value });

      if (redis) {
        try {
          await redis.setex(
            `${REDIS_PREFIX}${key}`,
            Math.ceil(ttlMs / 1000),
            JSON.stringify(value),
          );
        } catch {
          // Non-critical
        }
      }

      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function invalidateTournamentInsightsCache(tournamentId: number): void {
  const key = cacheKey(tournamentId);
  memory.delete(key);

  const redis = getRedisCommandClient();
  if (!redis) return;

  void redis.del(`${REDIS_PREFIX}${key}`).catch(() => {
    // Non-critical
  });
}
