import { getRedisCommandClient, getRedisSubscriberClient, isRedisEnabled, markRedisUnavailable } from "./redis";
import { writeSseToLocalClients } from "./broadcast";
import { logger } from "./logger";
import { db, auctionSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const EVENT_BUFFER_MAX = 500;
const VERSION_KEY = (tid: number) => `auction:version:${tid}`;
const EVENTS_KEY = (tid: number) => `auction:events:${tid}`;
const LAST_ACTIVITY_KEY = (tid: number) => `auction:lastActivity:${tid}`;
export const PUBSUB_CHANNEL = (tid: number) => `auction:event:${tid}`;

const ACTIVITY_EVENT_TYPES = new Set(["auction_state", "bid", "sold", "unsold"]);

/** Outbound auction SSE / pub-sub envelope. */
export type AuctionEventEnvelope = {
  version: number;
  tournamentId: number;
  type: string;
  lastAuctionActivityAt?: string | null;
  [key: string]: unknown;
};

/** In-memory fallbacks when Redis is unavailable (single-node dev). */
const localVersions = new Map<number, number>();
const localBuffers = new Map<number, string[]>();
const localLastActivity = new Map<number, string>();

export function isAuctionActivityEventType(type: string): boolean {
  return ACTIVITY_EVENT_TYPES.has(type);
}

export async function getLastAuctionActivityAt(tournamentId: number): Promise<string | null> {
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      const v = await redis.get(LAST_ACTIVITY_KEY(tournamentId));
      if (v) return v;
    } catch (err) {
      markRedisUnavailable(err, "getLastAuctionActivityAt");
    }
  }
  return localLastActivity.get(tournamentId) ?? null;
}

async function setLastAuctionActivityAt(tournamentId: number, iso: string): Promise<void> {
  localLastActivity.set(tournamentId, iso);
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      await redis.set(LAST_ACTIVITY_KEY(tournamentId), iso);
    } catch (err) {
      markRedisUnavailable(err, "setLastAuctionActivityAt");
    }
  }
}


/**
 * ============================================================================
 * BIDWAR AUCTION REVISION & EVENT VERSIONING CONTRACT
 * ============================================================================
 * 1. Single Authoritative Source of Truth:
 *    PostgreSQL `auction_sessions.revision` is the sole source of truth for
 *    the auction state revision. All state mutations (bid, pause, resume, sell,
 *    unsold, next player) commit within a transaction guarded by PostgreSQL
 *    advisory xact locks (`pg_advisory_xact_lock(tournamentId)`), incrementing
 *    `auction_sessions.revision`.
 *
 * 2. Monotonic Event Stream & Non-Regression Guarantee:
 *    Event versions emitted via Redis pub/sub and SSE (`auction:version:${tid}`)
 *    must be strictly monotonic and must never lag behind the committed database
 *    revision (`eventVersion >= auction_sessions.revision`).
 *
 * 3. Atomic Cold-Start Seeding & Concurrency Guard:
 *    On server boot, Redis restart, or key eviction, event version counters
 *    are atomically initialized via Lua script using the committed database
 *    revision as the base floor. Multi-instance API servers cannot race or
 *    clobber each other's version increments during cold start.
 *
 * 4. Crash Window Healing:
 *    If an API server crashes or network fails between the database transaction
 *    commit (at revision R) and event publication, Redis/local version counters
 *    will be healed to at least R upon next event query or emit. When clients
 *    reconnect across this gap, the sequence gap detector identifies the missing
 *    delta and automatically serves an authoritative `auction_state` snapshot frame
 *    aligned with PostgreSQL state.
 * ============================================================================
 */

export const LUA_NEXT_EVENT_VERSION = `
local key = KEYS[1]
local dbRev = tonumber(ARGV[1]) or 0
local current = redis.call('get', key)
local nextVal
if not current then
  if dbRev > 0 then
    nextVal = dbRev
  else
    nextVal = 1
  end
else
  local num = tonumber(current) or 0
  if dbRev > num then
    nextVal = dbRev
  else
    nextVal = num + 1
  end
end
redis.call('set', key, nextVal)
return nextVal
`;

export const LUA_GET_CURRENT_EVENT_VERSION = `
local key = KEYS[1]
local dbRev = tonumber(ARGV[1]) or 0
local current = redis.call('get', key)
if current then
  local num = tonumber(current) or 0
  if dbRev > num then
    redis.call('set', key, dbRev)
    return dbRev
  else
    return num
  end
else
  if dbRev > 0 then
    redis.call('set', key, dbRev)
    return dbRev
  else
    return 0
  end
end
`;

async function getPersistedRevision(tournamentId: number): Promise<number> {
  try {
    const [row] = await db
      .select({ revision: auctionSessionsTable.revision })
      .from(auctionSessionsTable)
      .where(eq(auctionSessionsTable.tournamentId, tournamentId));
    return row?.revision ?? 0;
  } catch (err) {
    logger.warn({ err, tournamentId }, "Failed to read persisted revision from DB");
    return 0;
  }
}

function bumpLocalVersion(tournamentId: number, dbRev: number): number {
  if (!localVersions.has(tournamentId)) {
    const nextVal = dbRev > 0 ? dbRev : 1;
    localVersions.set(tournamentId, nextVal);
    return nextVal;
  }
  const current = localVersions.get(tournamentId) ?? 0;
  const nextVal = dbRev > current ? dbRev : current + 1;
  localVersions.set(tournamentId, nextVal);
  return nextVal;
}

function bufferLocal(tournamentId: number, serialized: string): void {
  const buf = localBuffers.get(tournamentId) ?? [];
  buf.unshift(serialized);
  if (buf.length > EVENT_BUFFER_MAX) buf.length = EVENT_BUFFER_MAX;
  localBuffers.set(tournamentId, buf);
}

export function formatSseFrame(version: number, payload: Record<string, unknown>): string {
  return `id: ${version}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function getCurrentEventVersion(tournamentId: number): Promise<number> {
  const redis = getRedisCommandClient();
  const dbRev = await getPersistedRevision(tournamentId);

  if (redis) {
    try {
      const res = await redis.eval(LUA_GET_CURRENT_EVENT_VERSION, 1, VERSION_KEY(tournamentId), String(dbRev));
      return typeof res === "number" ? res : parseInt(String(res), 10);
    } catch (err) {
      markRedisUnavailable(err, "getCurrentEventVersion");
    }
  }

  if (!localVersions.has(tournamentId)) {
    localVersions.set(tournamentId, dbRev);
    return dbRev;
  }
  const current = localVersions.get(tournamentId) ?? 0;
  if (dbRev > current) {
    localVersions.set(tournamentId, dbRev);
    return dbRev;
  }
  return current;
}

export async function nextEventVersion(tournamentId: number, knownRevision?: number): Promise<number> {
  const dbRev = knownRevision !== undefined ? knownRevision : await getPersistedRevision(tournamentId);
  const redis = getRedisCommandClient();

  if (redis) {
    try {
      const res = await redis.eval(LUA_NEXT_EVENT_VERSION, 1, VERSION_KEY(tournamentId), String(dbRev));
      return typeof res === "number" ? res : parseInt(String(res), 10);
    } catch (err) {
      markRedisUnavailable(err, "nextEventVersion");
    }
  }

  return bumpLocalVersion(tournamentId, dbRev);
}

async function bufferEvent(tournamentId: number, serialized: string): Promise<void> {
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      const pipeline = redis.pipeline();
      pipeline.lpush(EVENTS_KEY(tournamentId), serialized);
      pipeline.ltrim(EVENTS_KEY(tournamentId), 0, EVENT_BUFFER_MAX - 1);
      await pipeline.exec();
      return;
    } catch (err) {
      markRedisUnavailable(err, "bufferEvent");
    }
  }
  bufferLocal(tournamentId, serialized);
}

/**
 * Publish an auction event to all server instances and local SSE clients.
 * When Redis is enabled, only pub/sub delivers to local clients (avoids duplicates).
 */
export async function publishAuctionEvent(
  tournamentId: number,
  event: Omit<AuctionEventEnvelope, "version" | "tournamentId" | "lastAuctionActivityAt"> & { type: string },
): Promise<AuctionEventEnvelope> {
  const version = await nextEventVersion(tournamentId);
  let lastAuctionActivityAt = await getLastAuctionActivityAt(tournamentId);
  if (isAuctionActivityEventType(event.type)) {
    lastAuctionActivityAt = new Date().toISOString();
    await setLastAuctionActivityAt(tournamentId, lastAuctionActivityAt);
  }
  const envelope: AuctionEventEnvelope = {
    ...event,
    version,
    tournamentId,
    lastAuctionActivityAt,
  };
  const serialized = JSON.stringify(envelope);

  await bufferEvent(tournamentId, serialized);

  const redis = getRedisCommandClient();
  if (redis) {
    try {
      await redis.publish(PUBSUB_CHANNEL(tournamentId), serialized);
      return envelope;
    } catch (err) {
      markRedisUnavailable(err, "publishAuctionEvent");
    }
  }
  writeSseToLocalClients(tournamentId, version, envelope);

  return envelope;
}

/** Replay events with version strictly greater than afterVersion (ascending). */
export async function getEventsAfter(
  tournamentId: number,
  afterVersion: number,
): Promise<AuctionEventEnvelope[]> {
  const redis = getRedisCommandClient();
  let raw: string[] = [];

  if (redis) {
    try {
      raw = await redis.lrange(EVENTS_KEY(tournamentId), 0, EVENT_BUFFER_MAX - 1);
    } catch (err) {
      markRedisUnavailable(err, "getEventsAfter");
      raw = localBuffers.get(tournamentId) ?? [];
    }
  } else {
    raw = localBuffers.get(tournamentId) ?? [];
  }

  const events: AuctionEventEnvelope[] = [];
  for (const line of raw) {
    try {
      const parsed = JSON.parse(line) as AuctionEventEnvelope;
      if (parsed.version > afterVersion) events.push(parsed);
    } catch {
      // skip corrupt buffer entries
    }
  }

  events.sort((a, b) => a.version - b.version);
  return events;
}

/** Subscribe to cross-instance auction events and fan out to local SSE clients. */
export async function startAuctionEventSubscriber(): Promise<void> {
  if (!isRedisEnabled()) return;

  const subscriber = getRedisSubscriberClient();
  if (!subscriber) return;

  try {
    await subscriber.psubscribe("auction:event:*");
  } catch (err) {
    markRedisUnavailable(err, "auction-event-psubscribe");
    return;
  }

  subscriber.on("pmessage", (_pattern, channel, message) => {
    if (typeof channel !== "string" || !channel.startsWith("auction:event:")) return;
    try {
      const event = JSON.parse(message) as AuctionEventEnvelope;
      writeSseToLocalClients(event.tournamentId, event.version, event);
    } catch (err) {
      logger.warn({ err }, "Failed to process pub/sub auction event");
    }
  });

  logger.info("Auction event Redis subscriber started");
}


export function setLocalEventVersionForTests(tournamentId: number, version: number): void {
  localVersions.set(tournamentId, version);
}

export function resetLocalEventStateForTests(tournamentId?: number): void {
  if (tournamentId != null) {
    localVersions.delete(tournamentId);
    localBuffers.delete(tournamentId);
    localLastActivity.delete(tournamentId);
  } else {
    localVersions.clear();
    localBuffers.clear();
    localLastActivity.clear();
  }
}
