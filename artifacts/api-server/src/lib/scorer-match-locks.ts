/**
 * Sport-agnostic scorer match lock service.
 * Locks by canonical match_id only — never inspects sport tables.
 * Hardened with server-authoritative lease fencing and generation tokens.
 */

import { and, eq, lt } from "drizzle-orm";
import { db, scorerMatchLocksTable } from "@workspace/db";
import { logger } from "./logger";
import { writeScorerAudit } from "./scorer-audit";

/** Client heartbeat target interval (seconds). */
export const SCORER_HEARTBEAT_INTERVAL_SEC = 20;

/** Lock is stale if last_heartbeat_at is older than this (seconds). */
export const SCORER_LOCK_TIMEOUT_SEC = 180;

export type ScorerLockErrorCode =
  | "MATCH_LOCKED"
  | "LOCK_NOT_OWNED"
  | "LOCK_NOT_FOUND"
  | "SCORER_LEASE_REQUIRED"
  | "SCORER_LEASE_EXPIRED"
  | "SCORER_LEASE_REVOKED"
  | "SCORER_LEASE_STALE";

export class ScorerLockError extends Error {
  constructor(
    message: string,
    public readonly code: ScorerLockErrorCode,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScorerLockError";
  }
}

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  forceTakeover?: boolean;
}): Promise<AcquireLockResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000);

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(scorerMatchLocksTable)
      .where(eq(scorerMatchLocksTable.matchId, input.matchId))
      .for("update");
    const existing = rows[0] ?? null;

    if (!existing) {
      const leaseId = crypto.randomUUID();
      const leaseVersion = 1;
      const [lock] = await tx
        .insert(scorerMatchLocksTable)
        .values({
          matchId: input.matchId,
          scorerId: input.scorerId,
          sessionId: input.sessionId,
          leaseId,
          leaseVersion,
          lockedAt: now,
          lastHeartbeatAt: now,
          expiresAt,
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
        payload: { leaseId, leaseVersion },
      });
      return { ok: true, reacquired: false, lock: lock! };
    }

    // Same session reacquisition / heartbeat refresh
    if (existing.sessionId === input.sessionId && !input.forceTakeover && !isStale(existing.lastHeartbeatAt, now)) {
      const [lock] = await tx
        .update(scorerMatchLocksTable)
        .set({
          lastHeartbeatAt: now,
          expiresAt,
          scorerId: input.scorerId,
        })
        .where(eq(scorerMatchLocksTable.matchId, input.matchId))
        .returning();
      return { ok: true, reacquired: false, lock: lock! };
    }

    if (input.forceTakeover || isStale(existing.lastHeartbeatAt, now)) {
      const action = input.forceTakeover ? "lock_force_takeover" : "lock_reacquired";
      const newVersion = (existing.leaseVersion ?? 0) + 1;
      const newLeaseId = crypto.randomUUID();

      if (!input.forceTakeover) {
        await writeScorerAudit({
          actorType: "system",
          actorId: "system",
          scorerId: existing.scorerId,
          sessionId: existing.sessionId,
          tournamentId: input.tournamentId,
          matchId: input.matchId,
          sport: input.sport,
          action: "lock_expired",
          payload: {
            reason: "stale_on_acquire",
            previousSessionId: existing.sessionId,
            previousLeaseVersion: existing.leaseVersion,
          },
        });
      }

      const [lock] = await tx
        .update(scorerMatchLocksTable)
        .set({
          scorerId: input.scorerId,
          sessionId: input.sessionId,
          leaseId: newLeaseId,
          leaseVersion: newVersion,
          lockedAt: now,
          lastHeartbeatAt: now,
          expiresAt,
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
        action,
        payload: {
          previousSessionId: existing.sessionId,
          previousScorerId: existing.scorerId,
          previousLeaseVersion: existing.leaseVersion,
          newLeaseVersion: newVersion,
          newLeaseId,
        },
      });

      return { ok: true, reacquired: true, lock: lock! };
    }

    return { ok: false, code: "MATCH_LOCKED" };
  });
}

export async function heartbeatMatchLock(input: {
  matchId: number;
  sessionId: string;
}): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000);

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(scorerMatchLocksTable)
      .where(eq(scorerMatchLocksTable.matchId, input.matchId))
      .for("update");
    const existing = rows[0] ?? null;

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
    if (isStale(existing.lastHeartbeatAt, now)) {
      throw new ScorerLockError("Match lock expired", "LOCK_NOT_OWNED", 403);
    }

    await tx
      .update(scorerMatchLocksTable)
      .set({
        lastHeartbeatAt: now,
        expiresAt,
      })
      .where(
        and(
          eq(scorerMatchLocksTable.matchId, input.matchId),
          eq(scorerMatchLocksTable.sessionId, input.sessionId),
        ),
      );
  });
}

export async function releaseMatchLock(input: {
  matchId: number;
  sessionId: string;
  scorerId: number;
  tournamentId?: number | null;
  sport?: string | null;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(scorerMatchLocksTable)
      .where(eq(scorerMatchLocksTable.matchId, input.matchId))
      .for("update");
    const existing = rows[0] ?? null;

    if (!existing) return false;
    if (existing.sessionId !== input.sessionId) {
      throw new ScorerLockError(
        "Only the session that owns the lock can release it",
        "LOCK_NOT_OWNED",
        403,
      );
    }

    await tx.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, input.matchId));
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
  });
}

export async function forceUnlockMatch(input: {
  matchId: number;
  actorType: "organizer" | "admin";
  actorId: string;
  tournamentId?: number | null;
  sport?: string | null;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(scorerMatchLocksTable)
      .where(eq(scorerMatchLocksTable.matchId, input.matchId))
      .for("update");
    const existing = rows[0] ?? null;

    if (!existing) return false;

    await tx.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, input.matchId));
    await writeScorerAudit({
      actorType: input.actorType,
      actorId: input.actorId,
      scorerId: existing.scorerId,
      sessionId: existing.sessionId,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      sport: input.sport,
      action: "force_unlock",
      payload: {
        previousSessionId: existing.sessionId,
        previousScorerId: existing.scorerId,
        previousLeaseVersion: existing.leaseVersion,
      },
    });
    return true;
  });
}

/** Return a non-stale lock for the match, or null if none / expired. */
export async function getFreshMatchLock(
  matchId: number,
): Promise<typeof scorerMatchLocksTable.$inferSelect | null> {
  const existing = await db
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, matchId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) return null;
  if (isStale(existing.lastHeartbeatAt)) return null;
  return existing;
}

/** Assert the session owns a fresh lock — used before score mutations. */
export async function assertSessionOwnsMatchLock(input: {
  matchId: number;
  sessionId: string;
  scorerId?: number;
  leaseId?: string | null;
  leaseVersion?: number | null;
}): Promise<typeof scorerMatchLocksTable.$inferSelect> {
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
  if (typeof input.scorerId === "number" && existing.scorerId !== input.scorerId) {
    throw new ScorerLockError(
      "This match is currently being scored by another active session.",
      "MATCH_LOCKED",
      409,
    );
  }
  if (typeof input.leaseVersion === "number" && existing.leaseVersion !== input.leaseVersion) {
    throw new ScorerLockError(
      `Stale scorer lease version: expected ${input.leaseVersion}, active is ${existing.leaseVersion}`,
      "SCORER_LEASE_STALE",
      409,
    );
  }
  if (input.leaseId && existing.leaseId !== input.leaseId) {
    throw new ScorerLockError(
      "Stale scorer lease token: lease has been superseded",
      "SCORER_LEASE_STALE",
      409,
    );
  }
  if (isStale(existing.lastHeartbeatAt)) {
    throw new ScorerLockError("Match lock expired — re-acquire before scoring", "LOCK_NOT_OWNED", 403);
  }

  return existing;
}

/**
 * Server-authoritative lease verification at the mutation transaction write boundary.
 * Locks the row FOR UPDATE in Postgres to prevent TOCTOU races with takeover or heartbeat.
 */
export async function assertAuthoritativeScorerLease(
  tx: DbTx,
  input: {
    matchId: number;
    scorerId: number;
    sessionId: string;
    leaseId?: string | null;
    leaseVersion?: number | null;
  },
  now = new Date(),
): Promise<typeof scorerMatchLocksTable.$inferSelect> {
  const rows = await tx
    .select()
    .from(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.matchId, input.matchId))
    .for("update");
  const lock = rows[0] ?? null;

  if (!lock) {
    throw new ScorerLockError(
      "Match lock required before scoring",
      "SCORER_LEASE_REQUIRED",
      409,
    );
  }

  if (lock.sessionId !== input.sessionId) {
    throw new ScorerLockError(
      "This match is currently being scored by another active session.",
      "SCORER_LEASE_REVOKED",
      409,
    );
  }

  if (lock.scorerId !== input.scorerId) {
    throw new ScorerLockError(
      "Scorer identity does not match current lease owner",
      "SCORER_LEASE_REVOKED",
      409,
    );
  }

  if (typeof input.leaseVersion === "number" && lock.leaseVersion !== input.leaseVersion) {
    throw new ScorerLockError(
      `Stale scorer lease version: expected ${input.leaseVersion}, active is ${lock.leaseVersion}`,
      "SCORER_LEASE_STALE",
      409,
    );
  }

  if (input.leaseId && lock.leaseId !== input.leaseId) {
    throw new ScorerLockError(
      "Stale scorer lease token: lease has been superseded",
      "SCORER_LEASE_STALE",
      409,
    );
  }

  if (isStale(lock.lastHeartbeatAt, now)) {
    throw new ScorerLockError(
      "Match lock expired — re-acquire before scoring",
      "SCORER_LEASE_EXPIRED",
      409,
    );
  }

  return lock;
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
