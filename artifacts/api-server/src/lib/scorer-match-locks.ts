/**
 * Sport-agnostic scorer match lock service.
 * Locks by canonical match_id only — never inspects sport tables.
 */

import { and, eq, lt } from "drizzle-orm";
import { db, scorerMatchLocksTable } from "@workspace/db";
import { logger } from "./logger";
import { writeScorerAudit } from "./scorer-audit";

/** Client heartbeat target interval (seconds). */
export const SCORER_HEARTBEAT_INTERVAL_SEC = 20;

/** Lock is stale if last_heartbeat_at is older than this (seconds). */
export const SCORER_LOCK_TIMEOUT_SEC = 180;

export class ScorerLockError extends Error {
  constructor(
    message: string,
    public readonly code: "MATCH_LOCKED" | "LOCK_NOT_OWNED" | "LOCK_NOT_FOUND",
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScorerLockError";
  }
}

function staleCutoff(now = new Date()): Date {
  return new Date(now.getTime() - SCORER_LOCK_TIMEOUT_SEC * 1000);
}

function isStale(lastHeartbeatAt: Date, now = new Date()): boolean {
  return lastHeartbeatAt.getTime() < staleCutoff(now).getTime();
}

export type AcquireLockResult =
  | { ok: true; reacquired: boolean; lock: typeof scorerMatchLocksTable.$inferSelect }
  | { ok: false; code: "MATCH_LOCKED" };

export async function acquireMatchLock(input: {
  matchId: number;
  scorerId: number;
  sessionId: string;
  tournamentId?: number | null;
  sport?: string | null;
}): Promise<AcquireLockResult> {
  const now = new Date();
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) {
    const [lock] = await db
      .insert(scorerMatchLocksTable)
      .values({
        matchId: input.matchId,
        scorerId: input.scorerId,
        sessionId: input.sessionId,
        lockedAt: now,
        lastHeartbeatAt: now,
      })
      .returning();
    await writeScorerAudit({
      actorType: "scorer",
      actorId: String(input.scorerId),
      scorerId: input.scorerId,
      sessionId: input.sessionId,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      sport: input.sport,
      action: "lock_acquired",
    });
    return { ok: true, reacquired: false, lock: lock! };
  }

  if (existing.sessionId === input.sessionId) {
    const [lock] = await db
      .update(scorerMatchLocksTable)
      .set({ lastHeartbeatAt: now, scorerId: input.scorerId })
      .where(eq(scorerMatchLocksTable.matchId, input.matchId))
      .returning();
    return { ok: true, reacquired: false, lock: lock! };
  }

  if (!isStale(existing.lastHeartbeatAt, now)) {
    return { ok: false, code: "MATCH_LOCKED" };
  }

  await writeScorerAudit({
    actorType: "system",
    actorId: "system",
    scorerId: existing.scorerId,
    sessionId: existing.sessionId,
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    sport: input.sport,
    action: "lock_expired",
    payload: { reason: "stale_on_acquire", previousSessionId: existing.sessionId },
  });

  const [lock] = await db
    .update(scorerMatchLocksTable)
    .set({
      scorerId: input.scorerId,
      sessionId: input.sessionId,
      lockedAt: now,
      lastHeartbeatAt: now,
    })
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .returning();

  await writeScorerAudit({
    actorType: "scorer",
    actorId: String(input.scorerId),
    scorerId: input.scorerId,
    sessionId: input.sessionId,
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    sport: input.sport,
    action: "lock_reacquired",
    payload: { previousSessionId: existing.sessionId },
  });

  return { ok: true, reacquired: true, lock: lock! };
}

export async function heartbeatMatchLock(input: {
  matchId: number;
  sessionId: string;
}): Promise<void> {
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) {
    throw new ScorerLockError("No lock for this match", "LOCK_NOT_FOUND", 404);
  }
  if (existing.sessionId !== input.sessionId) {
    throw new ScorerLockError(
      "This match is currently being scored by another active session.",
      "MATCH_LOCKED",
      409,
    );
  }
  if (isStale(existing.lastHeartbeatAt)) {
    throw new ScorerLockError("Match lock expired", "LOCK_NOT_OWNED", 403);
  }

  await db
    .update(scorerMatchLocksTable)
    .set({ lastHeartbeatAt: new Date() })
    .where(
      and(
        eq(scorerMatchLocksTable.matchId, input.matchId),
        eq(scorerMatchLocksTable.sessionId, input.sessionId),
      ),
    );
}

export async function releaseMatchLock(input: {
  matchId: number;
  sessionId: string;
  scorerId: number;
  tournamentId?: number | null;
  sport?: string | null;
}): Promise<boolean> {
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) return false;
  if (existing.sessionId !== input.sessionId) {
    throw new ScorerLockError(
      "Only the session that owns the lock can release it",
      "LOCK_NOT_OWNED",
      403,
    );
  }

  await db.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, input.matchId));
  await writeScorerAudit({
    actorType: "scorer",
    actorId: String(input.scorerId),
    scorerId: input.scorerId,
    sessionId: input.sessionId,
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    sport: input.sport,
    action: "lock_released",
  });
  return true;
}

export async function forceUnlockMatch(input: {
  matchId: number;
  actorType: "organizer" | "admin";
  actorId: string;
  tournamentId?: number | null;
  sport?: string | null;
}): Promise<boolean> {
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) return false;

  await db.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, input.matchId));
  await writeScorerAudit({
    actorType: input.actorType,
    actorId: input.actorId,
    scorerId: existing.scorerId,
    sessionId: existing.sessionId,
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    sport: input.sport,
    action: "force_unlock",
    payload: { previousSessionId: existing.sessionId, previousScorerId: existing.scorerId },
  });
  return true;
}

/** Assert the session owns a fresh lock — used before score mutations. */
export async function assertSessionOwnsMatchLock(input: {
  matchId: number;
  sessionId: string;
}): Promise<void> {
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) {
    throw new ScorerLockError("Match lock required before scoring", "LOCK_NOT_FOUND", 403);
  }
  if (existing.sessionId !== input.sessionId) {
    throw new ScorerLockError(
      "This match is currently being scored by another active session.",
      "MATCH_LOCKED",
      409,
    );
  }
  if (isStale(existing.lastHeartbeatAt)) {
    throw new ScorerLockError("Match lock expired — re-acquire before scoring", "LOCK_NOT_OWNED", 403);
  }
}

export async function releaseLockOnMatchFinish(input: {
  matchId: number;
  tournamentId?: number | null;
  sport?: string | null;
}): Promise<void> {
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) return;

  await db.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, input.matchId));
  await writeScorerAudit({
    actorType: "system",
    actorId: "system",
    scorerId: existing.scorerId,
    sessionId: existing.sessionId,
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    sport: input.sport,
    action: "lock_released",
    payload: { reason: "match_finished" },
  });
}

/** Remove stale locks. Returns count removed. */
export async function cleanupStaleMatchLocks(): Promise<number> {
  const cutoff = staleCutoff();
  const stale = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(lt(scorerMatchLocksTable.lastHeartbeatAt, cutoff));

  if (stale.length === 0) return 0;

  for (const lock of stale) {
    await db.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, lock.matchId));
    await writeScorerAudit({
      actorType: "system",
      actorId: "system",
      scorerId: lock.scorerId,
      sessionId: lock.sessionId,
      matchId: lock.matchId,
      action: "lock_expired",
      payload: { reason: "scheduled_cleanup" },
    });
  }

  logger.info({ count: stale.length }, "scorer match lock cleanup removed stale locks");
  return stale.length;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startScorerLockCleanupJob(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    void cleanupStaleMatchLocks().catch((err) => {
      logger.warn({ err }, "scorer match lock cleanup failed");
    });
  }, 60_000);
  // Avoid keeping the process alive solely for this timer in tests.
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}
