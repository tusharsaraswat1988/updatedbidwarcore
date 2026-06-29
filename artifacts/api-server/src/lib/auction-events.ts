import { getRedisCommandClient, getRedisSubscriberClient, isRedisEnabled, markRedisUnavailable } from "./redis";
import { writeSseToLocalClients } from "./broadcast";
import { logger } from "./logger";

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

function bumpLocalVersion(tournamentId: number): number {
  const next = (localVersions.get(tournamentId) ?? 0) + 1;
  localVersions.set(tournamentId, next);
  return next;
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
  if (redis) {
    try {
      const v = await redis.get(VERSION_KEY(tournamentId));
      return v ? parseInt(v, 10) : 0;
    } catch (err) {
      markRedisUnavailable(err, "getCurrentEventVersion");
    }
  }
  return localVersions.get(tournamentId) ?? 0;
}

async function nextEventVersion(tournamentId: number): Promise<number> {
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      return await redis.incr(VERSION_KEY(tournamentId));
    } catch (err) {
      markRedisUnavailable(err, "nextEventVersion");
    }
  }
  return bumpLocalVersion(tournamentId);
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

  await subscriber.psubscribe("auction:event:*");

  subscriber.on("pmessage", (_pattern, _channel, message) => {
    try {
      const event = JSON.parse(message) as AuctionEventEnvelope;
      writeSseToLocalClients(event.tournamentId, event.version, event);
    } catch (err) {
      logger.warn({ err }, "Failed to process pub/sub auction event");
    }
  });

  logger.info("Auction event Redis subscriber started");
}
