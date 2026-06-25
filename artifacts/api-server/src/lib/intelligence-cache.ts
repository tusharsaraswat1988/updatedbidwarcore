import { getRedisCommandClient } from "./redis";

const TTL_MS = 5 * 60 * 1000;
const REDIS_PREFIX = "intel:";

type CacheEntry = { expires: number; value: unknown };

const memory = new Map<string, CacheEntry>();

export interface IntelFilterParams {
  categoryId: number | null;
  teamId: number | null;
}

export function parseIntelFilters(query: Record<string, unknown>): IntelFilterParams {
  const categoryRaw = query.categoryId != null ? parseInt(String(query.categoryId), 10) : NaN;
  const teamRaw = query.teamId != null ? parseInt(String(query.teamId), 10) : NaN;
  return {
    categoryId: Number.isFinite(categoryRaw) ? categoryRaw : null,
    teamId: Number.isFinite(teamRaw) ? teamRaw : null,
  };
}

export function intelCacheKey(
  prefix: string,
  tournamentId: number,
  filters: IntelFilterParams = { categoryId: null, teamId: null },
): string {
  return `${prefix}:${tournamentId}:c${filters.categoryId ?? "all"}:t${filters.teamId ?? "all"}`;
}

/** Cached intelligence reads — in-memory with optional Redis for multi-instance. */
export async function getCachedIntel<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const memHit = memory.get(key);
  if (memHit && memHit.expires > now) {
    return memHit.value as T;
  }

  const redis = getRedisCommandClient();
  if (redis) {
    try {
      const raw = await redis.get(`${REDIS_PREFIX}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        memory.set(key, { expires: now + TTL_MS, value: parsed });
        return parsed;
      }
    } catch {
      // Fall through to fetcher
    }
  }

  const value = await fetcher();
  memory.set(key, { expires: now + TTL_MS, value });

  if (redis) {
    try {
      await redis.setex(`${REDIS_PREFIX}${key}`, Math.ceil(TTL_MS / 1000), JSON.stringify(value));
    } catch {
      // Non-critical
    }
  }

  return value;
}

export function invalidateIntelCacheForTournament(tournamentId: number): void {
  const needle = `:${tournamentId}:`;
  for (const key of memory.keys()) {
    if (key.includes(needle)) memory.delete(key);
  }

  const redis = getRedisCommandClient();
  if (!redis) return;

  void (async () => {
    try {
      let cursor = "0";
      const pattern = `${REDIS_PREFIX}*:${tournamentId}:*`;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== "0");
    } catch {
      // Non-critical — cache entries expire within TTL
    }
  })();
}
