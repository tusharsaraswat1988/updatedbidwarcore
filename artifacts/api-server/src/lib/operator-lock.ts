/**
 * Distributed operator controller lock — one active tab per tournament.
 * Uses Redis when REDIS_URL is set; falls back to in-memory for single-node dev.
 */

import { getRedisCommandClient } from "./redis";

const LOCK_TTL_SEC = 8;
const LOCK_KEY = (tournamentId: number) => `auction:lock:${tournamentId}`;

export interface OperatorLockRecord {
  sessionId: string;
  ownerId: string;
  timestamp: number;
}

interface OperatorLockEntry {
  tabId: string;
  ownerId: string;
  lastHeartbeat: number;
  acquiredAt: number;
}

const memoryLocks = new Map<number, OperatorLockEntry>();

function lockKeyTtlMs(): number {
  return LOCK_TTL_SEC * 1000;
}

function isExpired(entry: OperatorLockEntry, now = Date.now()): boolean {
  return now - entry.lastHeartbeat > lockKeyTtlMs();
}

function serializeLock(sessionId: string, ownerId: string, timestamp: number): string {
  return JSON.stringify({ sessionId, ownerId, timestamp } satisfies OperatorLockRecord);
}

function parseLock(raw: string | null): OperatorLockRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OperatorLockRecord;
    if (parsed.sessionId && parsed.ownerId && parsed.timestamp) return parsed;
  } catch {
    // legacy plain tabId string
    return { sessionId: raw, ownerId: "unknown", timestamp: Date.now() };
  }
  return null;
}

export async function acquireOperatorLock(
  tournamentId: number,
  sessionId: string,
  ownerId: string,
): Promise<{ acquired: boolean; holderTabId: string | null }> {
  const redis = getRedisCommandClient();
  const now = Date.now();

  if (redis) {
    const key = LOCK_KEY(tournamentId);
    const existing = parseLock(await redis.get(key));

    if (existing && existing.sessionId !== sessionId) {
      const age = now - existing.timestamp;
      if (age <= lockKeyTtlMs()) {
        return { acquired: false, holderTabId: existing.sessionId };
      }
      // Timestamp expired but Redis key may still exist — clear so NX can succeed.
      // Without this, two fresh tabs both see a dead holder and both stay read-only.
      await redis.del(key);
    }

    const payload = serializeLock(sessionId, ownerId, now);
    const ok = await redis.set(key, payload, "EX", LOCK_TTL_SEC, "NX");
    if (ok === "OK") {
      return { acquired: true, holderTabId: sessionId };
    }

    const holder = parseLock(await redis.get(key));
    if (holder?.sessionId === sessionId) {
      await redis.set(key, serializeLock(sessionId, ownerId, now), "EX", LOCK_TTL_SEC);
      return { acquired: true, holderTabId: sessionId };
    }

    return { acquired: false, holderTabId: holder?.sessionId ?? null };
  }

  const existing = memoryLocks.get(tournamentId);
  if (existing && !isExpired(existing, now) && existing.tabId !== sessionId) {
    return { acquired: false, holderTabId: existing.tabId };
  }

  memoryLocks.set(tournamentId, {
    tabId: sessionId,
    ownerId,
    lastHeartbeat: now,
    acquiredAt: now,
  });
  return { acquired: true, holderTabId: sessionId };
}

export async function heartbeatOperatorLock(
  tournamentId: number,
  sessionId: string,
  ownerId: string,
): Promise<{ ok: boolean; holderTabId: string | null }> {
  const redis = getRedisCommandClient();
  const now = Date.now();

  if (redis) {
    const key = LOCK_KEY(tournamentId);
    const existing = parseLock(await redis.get(key));

    if (!existing || now - existing.timestamp > lockKeyTtlMs()) {
      await redis.set(key, serializeLock(sessionId, ownerId, now), "EX", LOCK_TTL_SEC);
      return { ok: true, holderTabId: sessionId };
    }

    if (existing.sessionId !== sessionId) {
      return { ok: false, holderTabId: existing.sessionId };
    }

    await redis.set(key, serializeLock(sessionId, ownerId, now), "EX", LOCK_TTL_SEC);
    return { ok: true, holderTabId: sessionId };
  }

  const existing = memoryLocks.get(tournamentId);
  if (!existing || isExpired(existing, now)) {
    memoryLocks.set(tournamentId, {
      tabId: sessionId,
      ownerId,
      lastHeartbeat: now,
      acquiredAt: now,
    });
    return { ok: true, holderTabId: sessionId };
  }

  if (existing.tabId !== sessionId) {
    return { ok: false, holderTabId: existing.tabId };
  }

  existing.lastHeartbeat = now;
  return { ok: true, holderTabId: sessionId };
}

export async function releaseOperatorLock(
  tournamentId: number,
  sessionId: string,
): Promise<void> {
  const redis = getRedisCommandClient();

  if (redis) {
    const key = LOCK_KEY(tournamentId);
    const existing = parseLock(await redis.get(key));
    if (existing?.sessionId === sessionId) {
      await redis.del(key);
    }
    return;
  }

  const existing = memoryLocks.get(tournamentId);
  if (existing?.tabId === sessionId) {
    memoryLocks.delete(tournamentId);
  }
}

/**
 * Force-acquire the operator lock for a specific tab, unconditionally
 * displacing whatever holder currently exists.  Used by the explicit
 * "Take Over" UX — only callable by an authenticated organizer who has
 * confirmed the takeover intent in the UI.
 */
export async function forceAcquireOperatorLock(
  tournamentId: number,
  sessionId: string,
  ownerId: string,
): Promise<{ acquired: boolean; holderTabId: string }> {
  const redis = getRedisCommandClient();
  const now = Date.now();
  const payload = serializeLock(sessionId, ownerId, now);

  if (redis) {
    await redis.set(LOCK_KEY(tournamentId), payload, "EX", LOCK_TTL_SEC);
    return { acquired: true, holderTabId: sessionId };
  }

  memoryLocks.set(tournamentId, {
    tabId: sessionId,
    ownerId,
    lastHeartbeat: now,
    acquiredAt: now,
  });
  return { acquired: true, holderTabId: sessionId };
}

export async function getOperatorLockHolder(tournamentId: number): Promise<string | null> {
  const redis = getRedisCommandClient();

  if (redis) {
    const existing = parseLock(await redis.get(LOCK_KEY(tournamentId)));
    if (!existing) return null;
    if (Date.now() - existing.timestamp > lockKeyTtlMs()) {
      await redis.del(LOCK_KEY(tournamentId));
      return null;
    }
    return existing.sessionId;
  }

  const existing = memoryLocks.get(tournamentId);
  if (!existing || isExpired(existing)) {
    if (existing) memoryLocks.delete(tournamentId);
    return null;
  }
  return existing.tabId;
}
