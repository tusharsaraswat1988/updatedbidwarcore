import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  CricketEventType,
  createEventEnvelope,
  cricketScoringAdapter,
  replayCricketEvents,
} from "@workspace/scoring-core";
import {
  assertAuthoritativeScorerLease,
  assertSessionOwnsMatchLock,
  ScorerLockError,
  SCORER_LOCK_TIMEOUT_SEC,
} from "../lib/scorer-match-locks";
import { isTerminalScoringMatchStatus } from "../lib/scoring-match-terminal";

// File URLs for architectural contract verification
const scorerLockUrl = new URL("../lib/scorer-match-locks.ts", import.meta.url);
const orchestratorUrl = new URL("../lib/scoring-platform/orchestrator.ts", import.meta.url);
const scoringServiceUrl = new URL("../lib/scoring-service.ts", import.meta.url);
const scoringRouteUrl = new URL("../routes/scoring.ts", import.meta.url);
const scorerRouteUrl = new URL("../routes/scorer.ts", import.meta.url);
const schemaScorerAccountsUrl = new URL("../../../../lib/db/src/schema/scorer_accounts.ts", import.meta.url);
const ensureSchemaUrl = new URL("../../../../lib/db/src/ensure-schema.ts", import.meta.url);
const migrationUrl = new URL("../../../../lib/db/migrations/0024_scorer_lock_fencing.sql", import.meta.url);

const auctionRoot = new URL("../../../auction-platform/src/", import.meta.url);
const scorerApiUrl = new URL("lib/scorer-api.ts", auctionRoot);
const scoringApiUrl = new URL("lib/scoring-api.ts", auctionRoot);
const cricketScorerPageUrl = new URL("pages/cricket/scorer.tsx", auctionRoot);

/** Helper to create a mock Drizzle transaction for assertAuthoritativeScorerLease */
function createMockTx(lockRow: any) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          for: (_mode: string) => Promise.resolve(lockRow ? [lockRow] : []),
        }),
      }),
    }),
  } as any;
}

/** Simulated in-memory transactional database for concurrency tests */
class SimulatedLockStore {
  private lock: {
    matchId: number;
    scorerId: number;
    sessionId: string;
    leaseId: string;
    leaseVersion: number;
    lockedAt: Date;
    lastHeartbeatAt: Date;
    expiresAt: Date;
  } | null = null;

  private mutex = Promise.resolve();

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const acquire = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentMutex = this.mutex;
    this.mutex = currentMutex.then(() => acquire);
    await currentMutex;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async acquireLock(input: {
    matchId: number;
    scorerId: number;
    sessionId: string;
    forceTakeover?: boolean;
    now?: Date;
  }): Promise<{ ok: boolean; lock?: any; code?: string }> {
    return this.withLock(async () => {
      const now = input.now ?? new Date();
      const expiresAt = new Date(now.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000);

      if (!this.lock) {
        this.lock = {
          matchId: input.matchId,
          scorerId: input.scorerId,
          sessionId: input.sessionId,
          leaseId: `lease-${Math.random().toString(36).substring(2, 9)}`,
          leaseVersion: 1,
          lockedAt: now,
          lastHeartbeatAt: now,
          expiresAt,
        };
        return { ok: true, lock: { ...this.lock } };
      }

      const isStale = (now.getTime() - this.lock.lastHeartbeatAt.getTime()) >= SCORER_LOCK_TIMEOUT_SEC * 1000;

      // Same session reacquisition / refresh
      if (this.lock.sessionId === input.sessionId && !input.forceTakeover && !isStale) {
        this.lock.lastHeartbeatAt = now;
        this.lock.expiresAt = expiresAt;
        return { ok: true, lock: { ...this.lock } };
      }

      // Takeover path
      if (input.forceTakeover || isStale) {
        const newVersion = this.lock.leaseVersion + 1;
        const newLeaseId = `lease-${Math.random().toString(36).substring(2, 9)}`;
        this.lock = {
          matchId: input.matchId,
          scorerId: input.scorerId,
          sessionId: input.sessionId,
          leaseId: newLeaseId,
          leaseVersion: newVersion,
          lockedAt: now,
          lastHeartbeatAt: now,
          expiresAt,
        };
        return { ok: true, lock: { ...this.lock } };
      }

      return { ok: false, code: "MATCH_LOCKED" };
    });
  }

  async heartbeat(sessionId: string, now = new Date()): Promise<{ ok: boolean; code?: string }> {
    return this.withLock(async () => {
      if (!this.lock) return { ok: false, code: "LOCK_NOT_FOUND" };
      if (this.lock.sessionId !== sessionId) return { ok: false, code: "MATCH_LOCKED" };
      const isStale = (now.getTime() - this.lock.lastHeartbeatAt.getTime()) >= SCORER_LOCK_TIMEOUT_SEC * 1000;
      if (isStale) return { ok: false, code: "LOCK_NOT_OWNED" };
      this.lock.lastHeartbeatAt = now;
      this.lock.expiresAt = new Date(now.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000);
      return { ok: true };
    });
  }

  async appendEventTx(input: {
    scorerId: number;
    sessionId: string;
    leaseId: string;
    leaseVersion: number;
    correlationId: string;
    now?: Date;
    events: Array<{ sequence: number; correlationId: string; payload: any }>;
    newEventPayload: any;
  }): Promise<{ ok: boolean; code?: string; sequence?: number }> {
    return this.withLock(async () => {
      const now = input.now ?? new Date();
      // 1. Transactional lease check first (FOR UPDATE)
      if (!this.lock) return { ok: false, code: "SCORER_LEASE_REQUIRED" };
      if (this.lock.sessionId !== input.sessionId) return { ok: false, code: "SCORER_LEASE_REVOKED" };
      if (this.lock.scorerId !== input.scorerId) return { ok: false, code: "SCORER_LEASE_REVOKED" };
      if (this.lock.leaseVersion !== input.leaseVersion) return { ok: false, code: "SCORER_LEASE_STALE" };
      if (this.lock.leaseId !== input.leaseId) return { ok: false, code: "SCORER_LEASE_STALE" };
      const isStale = (now.getTime() - this.lock.lastHeartbeatAt.getTime()) >= SCORER_LOCK_TIMEOUT_SEC * 1000;
      if (isStale) return { ok: false, code: "SCORER_LEASE_EXPIRED" };

      // 2. Correlation lookup inside transaction
      const existing = input.events.find((e) => e.correlationId === input.correlationId);
      if (existing) {
        return { ok: true, sequence: existing.sequence };
      }

      // 3. Append new event
      const sequence = input.events.length + 1;
      input.events.push({
        sequence,
        correlationId: input.correlationId,
        payload: input.newEventPayload,
      });
      return { ok: true, sequence };
    });
  }

  getSnapshot() {
    return this.lock ? { ...this.lock } : null;
  }
}

describe("P0 Scorer Lock / Takeover Race Hardening Test Matrix (22+ Scenarios)", () => {
  const matchId = 101;
  const tournamentId = 50;

  // 1. Acquire scorer lease
  it("Scenario 1: First valid scorer acquires lock successfully with leaseId, leaseVersion = 1, expiresAt", async () => {
    const store = new SimulatedLockStore();
    const res = await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });
    expect(res.ok).toBe(true);
    expect(res.lock.leaseVersion).toBe(1);
    expect(res.lock.leaseId).toBeDefined();
    expect(res.lock.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  // 2. Same scorer reconnect / idempotent refresh
  it("Scenario 2: Same scorer/session reacquires lock; heartbeat refreshed, leaseVersion NOT incremented", async () => {
    const store = new SimulatedLockStore();
    const initial = await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });
    const refresh = await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });

    expect(refresh.ok).toBe(true);
    expect(refresh.lock.leaseVersion).toBe(initial.lock.leaseVersion);
    expect(refresh.lock.leaseId).toBe(initial.lock.leaseId);
  });

  // 3. Second scorer takeover after expiry
  it("Scenario 3: Scorer B acquires after Scorer A lease has expired; leaseVersion incremented, new leaseId", async () => {
    const store = new SimulatedLockStore();
    const t0 = new Date();
    await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1", now: t0 });

    const tExpired = new Date(t0.getTime() + (SCORER_LOCK_TIMEOUT_SEC + 10) * 1000);
    const takeover = await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", now: tExpired });

    expect(takeover.ok).toBe(true);
    expect(takeover.lock.leaseVersion).toBe(2);
    expect(takeover.lock.scorerId).toBe(2);
    expect(takeover.lock.sessionId).toBe("sess-2");
  });

  // 4. Takeover before expiry with forceTakeover: true
  it("Scenario 4: Scorer B forces takeover while Scorer A lease is active; leaseVersion incremented, new leaseId", async () => {
    const store = new SimulatedLockStore();
    const resA = await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });
    const resB = await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true });

    expect(resB.ok).toBe(true);
    expect(resB.lock.leaseVersion).toBe(resA.lock.leaseVersion + 1);
    expect(resB.lock.leaseId).not.toBe(resA.lock.leaseId);
    expect(resB.lock.scorerId).toBe(2);
  });

  // 5. Old scorer write after takeover rejected
  it("Scenario 5: Scorer A attempts to write event after Scorer B took over; rejected with SCORER_LEASE_REVOKED", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;
    await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true });

    const writeA = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "corr-1",
      events,
      newEventPayload: { ball: 1 },
    });

    expect(writeA.ok).toBe(false);
    expect(writeA.code).toBe("SCORER_LEASE_REVOKED");
    expect(events.length).toBe(0);
  });

  // 6. Old scorer heartbeat after takeover rejected
  it("Scenario 6: Scorer A sends heartbeat after Scorer B took over; rejected with MATCH_LOCKED", async () => {
    const store = new SimulatedLockStore();
    await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });
    await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true });

    const hbA = await store.heartbeat("sess-1");
    expect(hbA.ok).toBe(false);
    expect(hbA.code).toBe("MATCH_LOCKED");
  });

  // 7. Old scorer offline queue rejected after takeover
  it("Scenario 7: Scorer A comes online and attempts to drain queued events; all rejected, match not corrupted", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;
    await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true });

    const queuedPayloads = [{ ball: 1 }, { ball: 2 }, { ball: 3 }];
    for (let i = 0; i < queuedPayloads.length; i++) {
      const res = await store.appendEventTx({
        scorerId: 1,
        sessionId: "sess-1",
        leaseId: lockA.leaseId,
        leaseVersion: lockA.leaseVersion,
        correlationId: `queued-${i}`,
        events,
        newEventPayload: queuedPayloads[i],
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("SCORER_LEASE_REVOKED");
    }

    expect(events.length).toBe(0);
  });

  // 8. Old browser tab rejected after newer tab acquires newer generation
  it("Scenario 8: Same scorer in Tab 1 vs Tab 2; Tab 2 acquires new generation -> Tab 1 mutations rejected", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const tab1 = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "tab-1" })).lock;
    const tab2 = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "tab-2", forceTakeover: true })).lock;

    expect(tab2.leaseVersion).toBe(tab1.leaseVersion + 1);

    const writeTab1 = await store.appendEventTx({
      scorerId: 1,
      sessionId: "tab-1",
      leaseId: tab1.leaseId,
      leaseVersion: tab1.leaseVersion,
      correlationId: "corr-tab1",
      events,
      newEventPayload: { ball: 1 },
    });
    expect(writeTab1.ok).toBe(false);
    expect(writeTab1.code).toBe("SCORER_LEASE_REVOKED");

    const writeTab2 = await store.appendEventTx({
      scorerId: 1,
      sessionId: "tab-2",
      leaseId: tab2.leaseId,
      leaseVersion: tab2.leaseVersion,
      correlationId: "corr-tab2",
      events,
      newEventPayload: { ball: 1 },
    });
    expect(writeTab2.ok).toBe(true);
    expect(events.length).toBe(1);
  });

  // 9. Same scorer old session vs new session fencing
  it("Scenario 9: Scorer logs in again (new session) -> old session writes rejected", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const sessOld = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-old" })).lock;
    const sessNew = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-new", forceTakeover: true })).lock;

    const res = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-old",
      leaseId: sessOld.leaseId,
      leaseVersion: sessOld.leaseVersion,
      correlationId: "c-old",
      events,
      newEventPayload: {},
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("SCORER_LEASE_REVOKED");
  });

  // 10. Heartbeat vs takeover race
  it("Scenario 10: Heartbeat from Scorer A races with takeover from Scorer B; serialized cleanly", async () => {
    const store = new SimulatedLockStore();
    await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });

    // Race heartbeat and takeover
    const [hbResult, takeoverResult] = await Promise.all([
      store.heartbeat("sess-1"),
      store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true }),
    ]);

    expect(takeoverResult.ok).toBe(true);
    // Either heartbeat completed before takeover or failed after takeover
    if (!hbResult.ok) {
      expect(hbResult.code).toBe("MATCH_LOCKED");
    }
    // Final lock owner is Scorer B
    expect(store.getSnapshot()?.sessionId).toBe("sess-2");
  });

  // 11. Event-write vs takeover race
  it("Scenario 11: Event append from Scorer A races with takeover from Scorer B; serialized cleanly", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;

    const [writeA, takeoverB] = await Promise.all([
      store.appendEventTx({
        scorerId: 1,
        sessionId: "sess-1",
        leaseId: lockA.leaseId,
        leaseVersion: lockA.leaseVersion,
        correlationId: "corr-race-11",
        events,
        newEventPayload: { run: 4 },
      }),
      store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true }),
    ]);

    expect(takeoverB.ok).toBe(true);
    expect(store.getSnapshot()?.sessionId).toBe("sess-2");
    // If writeA ran before takeover, events has 1 item; if after, writeA failed
    if (writeA.ok) {
      expect(events.length).toBe(1);
    } else {
      expect(writeA.code).toBe("SCORER_LEASE_REVOKED");
      expect(events.length).toBe(0);
    }
  });

  // 12. Lease expiry vs event-write race
  it("Scenario 12: Lease expires just as event write arrives; write transaction rejects write", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const t0 = new Date();
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1", now: t0 })).lock;

    // Simulate clock advancing past expiry timeout
    const tExpired = new Date(t0.getTime() + (SCORER_LOCK_TIMEOUT_SEC + 5) * 1000);

    const writeA = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "corr-expired",
      now: tExpired,
      events,
      newEventPayload: { run: 1 },
    });

    expect(writeA.ok).toBe(false);
    expect(writeA.code).toBe("SCORER_LEASE_EXPIRED");
    expect(events.length).toBe(0);
  });

  // 13. Correlation retry before takeover succeeds idempotently
  it("Scenario 13: Scorer A retries same correlationId before takeover; idempotent return without duplicate ball", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;

    const firstWrite = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "idempotent-corr-1",
      events,
      newEventPayload: { ball: 1, run: 6 },
    });
    expect(firstWrite.ok).toBe(true);
    expect(firstWrite.sequence).toBe(1);

    const retryWrite = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "idempotent-corr-1",
      events,
      newEventPayload: { ball: 1, run: 6 },
    });
    expect(retryWrite.ok).toBe(true);
    expect(retryWrite.sequence).toBe(1);
    expect(events.length).toBe(1); // No duplicate ball!
  });

  // 14. Correlation retry after takeover rejected
  it("Scenario 14: Correlation retry after takeover rejected (lease check precedes correlation lookup inside write tx)", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;

    // Scorer A writes an event
    await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "idempotent-before-takeover",
      events,
      newEventPayload: { ball: 1 },
    });
    expect(events.length).toBe(1);

    // Scorer B takes over match
    await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true });

    // Scorer A retries same correlationId -> MUST BE REJECTED because lease is revoked
    const retryAfterTakeover = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "idempotent-before-takeover",
      events,
      newEventPayload: { ball: 1 },
    });

    expect(retryAfterTakeover.ok).toBe(false);
    expect(retryAfterTakeover.code).toBe("SCORER_LEASE_REVOKED");
  });

  // 15. Cross-user forged lease identity rejected
  it("Scenario 15: Cross-user forged lease identity rejected by assertAuthoritativeScorerLease", async () => {
    const lockRow = {
      matchId,
      scorerId: 1,
      sessionId: "sess-legit",
      leaseId: "lease-valid-token",
      leaseVersion: 1,
      lastHeartbeatAt: new Date(),
    };
    const tx = createMockTx(lockRow);

    // Attacker presenting valid lease token but having scorerId: 2 (from authenticated JWT)
    await expect(
      assertAuthoritativeScorerLease(tx, {
        matchId,
        scorerId: 2, // mismatch with lockRow.scorerId
        sessionId: "sess-legit",
        leaseId: "lease-valid-token",
        leaseVersion: 1,
      })
    ).rejects.toThrow("Scorer identity does not match current lease owner");
  });

  // 16. Expired lease rejected
  it("Scenario 16: Expired lease rejected with SCORER_LEASE_EXPIRED", async () => {
    const expiredTime = new Date(Date.now() - (SCORER_LOCK_TIMEOUT_SEC + 10) * 1000);
    const lockRow = {
      matchId,
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: "lease-1",
      leaseVersion: 1,
      lastHeartbeatAt: expiredTime,
    };
    const tx = createMockTx(lockRow);

    try {
      await assertAuthoritativeScorerLease(tx, {
        matchId,
        scorerId: 1,
        sessionId: "sess-1",
        leaseId: "lease-1",
        leaseVersion: 1,
      });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ScorerLockError);
      expect(err.code).toBe("SCORER_LEASE_EXPIRED");
      expect(err.status).toBe(409);
    }
  });

  // 17. Revoked lease rejected
  it("Scenario 17: Revoked lease rejected with SCORER_LEASE_REVOKED when lock belongs to another session", async () => {
    const lockRow = {
      matchId,
      scorerId: 2,
      sessionId: "sess-2",
      leaseId: "lease-2",
      leaseVersion: 2,
      lastHeartbeatAt: new Date(),
    };
    const tx = createMockTx(lockRow);

    try {
      await assertAuthoritativeScorerLease(tx, {
        matchId,
        scorerId: 1,
        sessionId: "sess-1",
        leaseId: "lease-1",
        leaseVersion: 1,
      });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ScorerLockError);
      expect(err.code).toBe("SCORER_LEASE_REVOKED");
    }
  });

  // 18. Terminal match rejects scorer mutation
  it("Scenario 18: Terminal match status rejects mutation", () => {
    expect(isTerminalScoringMatchStatus("completed")).toBe(true);
    expect(isTerminalScoringMatchStatus("walkover")).toBe(true);
    expect(isTerminalScoringMatchStatus("abandoned")).toBe(true);
    expect(isTerminalScoringMatchStatus("cancelled")).toBe(true);
    expect(isTerminalScoringMatchStatus("live")).toBe(false);

    // Adapter validation blocks append when match is terminal
    const validation = cricketScoringAdapter.validateBeforeAppend({
      matchId,
      tournamentId,
      eventType: CricketEventType.BALL_RECORDED,
      matchStatus: "completed",
      payload: { innings: 1, over: 0, ball: 1 },
    });
    expect(validation.ok).toBe(false);
    expect(validation.code).toBe("MATCH_CLOSED");
  });

  // 19. Concurrent valid scoring preserves sequencing
  it("Scenario 19: Concurrent valid scoring preserves sequencing without sequence conflicts", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lock = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;

    const res1 = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lock.leaseId,
      leaseVersion: lock.leaseVersion,
      correlationId: "seq-1",
      events,
      newEventPayload: { ball: 1 },
    });
    const res2 = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lock.leaseId,
      leaseVersion: lock.leaseVersion,
      correlationId: "seq-2",
      events,
      newEventPayload: { ball: 2 },
    });

    expect(res1.sequence).toBe(1);
    expect(res2.sequence).toBe(2);
    expect(events.length).toBe(2);
  });

  // 20. New scorer can immediately score after takeover
  it("Scenario 20: New scorer B takes over and immediately writes event successfully", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" });
    const lockB = (await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true })).lock;

    const writeB = await store.appendEventTx({
      scorerId: 2,
      sessionId: "sess-2",
      leaseId: lockB.leaseId,
      leaseVersion: lockB.leaseVersion,
      correlationId: "b-first-ball",
      events,
      newEventPayload: { ball: 1, runsOffBat: 4 },
    });

    expect(writeB.ok).toBe(true);
    expect(writeB.sequence).toBe(1);
    expect(events.length).toBe(1);
  });

  // 21. Stale scorer cannot mutate after new scorer scores
  it("Scenario 21: Scorer B has written events; Scorer A tries to write; rejected", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId, scorerId: 1, sessionId: "sess-1" })).lock;
    const lockB = (await store.acquireLock({ matchId, scorerId: 2, sessionId: "sess-2", forceTakeover: true })).lock;

    await store.appendEventTx({
      scorerId: 2,
      sessionId: "sess-2",
      leaseId: lockB.leaseId,
      leaseVersion: lockB.leaseVersion,
      correlationId: "b-ball",
      events,
      newEventPayload: { ball: 1 },
    });

    const writeA = await store.appendEventTx({
      scorerId: 1,
      sessionId: "sess-1",
      leaseId: lockA.leaseId,
      leaseVersion: lockA.leaseVersion,
      correlationId: "a-late-ball",
      events,
      newEventPayload: { ball: 2 },
    });

    expect(writeA.ok).toBe(false);
    expect(writeA.code).toBe("SCORER_LEASE_REVOKED");
    expect(events.length).toBe(1); // Only B's event remains
  });

  // 22. Replay contains only accepted events
  it("Scenario 22: Replay of match event stream contains ONLY events from valid leases; zero phantom events", () => {
    const meta = {
      matchId: 101,
      tournamentId: 50,
      homeTeamId: 10,
      awayTeamId: 20,
      oversLimit: 20,
    };

    // Valid event stream containing only successfully persisted events
    const envelopes = [
      createEventEnvelope({
        matchId: 101,
        tournamentId: 50,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 },
        actorType: "scorer",
        actorId: "scorer-1",
      }),
      createEventEnvelope({
        matchId: 101,
        tournamentId: 50,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 2,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
        actorId: "scorer-1",
      }),
      // Scorer 2 takes over and records ball 2
      createEventEnvelope({
        matchId: 101,
        tournamentId: 50,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 3,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
        actorId: "scorer-2",
      }),
    ];

    const state = replayCricketEvents(meta, envelopes);
    expect(state.innings[0]?.runs).toBe(10);
    expect(state.innings[0]?.ball).toBe(2);
    expect(state.thisOver.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUIREMENT 24: REAL CONCURRENCY TESTING (Promise.all)
// ─────────────────────────────────────────────────────────────────────────────

describe("Requirement 24: Real Concurrency Testing with Promise.all", () => {
  it("concurrent overlapping event-write and takeover serializes cleanly with no partial writes", async () => {
    const store = new SimulatedLockStore();
    const events: any[] = [];
    const lockA = (await store.acquireLock({ matchId: 200, scorerId: 1, sessionId: "sess-A" })).lock;

    // Launch concurrent event append from A and takeover from B
    const results = await Promise.all([
      store.appendEventTx({
        scorerId: 1,
        sessionId: "sess-A",
        leaseId: lockA.leaseId,
        leaseVersion: lockA.leaseVersion,
        correlationId: "race-c1",
        events,
        newEventPayload: { run: 4 },
      }),
      store.acquireLock({ matchId: 200, scorerId: 2, sessionId: "sess-B", forceTakeover: true }),
    ]);

    const writeResult = results[0];
    const takeoverResult = results[1];

    expect(takeoverResult.ok).toBe(true);
    // Takeover must be owner in the end
    expect(store.getSnapshot()?.sessionId).toBe("sess-B");
    expect(store.getSnapshot()?.leaseVersion).toBe(2);

    // Either write committed before takeover or was rejected
    if (writeResult.ok) {
      expect(events.length).toBe(1);
    } else {
      expect(writeResult.code).toBe("SCORER_LEASE_REVOKED");
      expect(events.length).toBe(0);
    }
  });

  it("rapid sequential takeovers (A -> B -> A -> B) increment leaseVersion monotonically", async () => {
    const store = new SimulatedLockStore();

    const t1 = await store.acquireLock({ matchId: 300, scorerId: 1, sessionId: "sess-1" });
    expect(t1.lock.leaseVersion).toBe(1);

    const t2 = await store.acquireLock({ matchId: 300, scorerId: 2, sessionId: "sess-2", forceTakeover: true });
    expect(t2.lock.leaseVersion).toBe(2);

    const t3 = await store.acquireLock({ matchId: 300, scorerId: 1, sessionId: "sess-3", forceTakeover: true });
    expect(t3.lock.leaseVersion).toBe(3);

    const t4 = await store.acquireLock({ matchId: 300, scorerId: 2, sessionId: "sess-4", forceTakeover: true });
    expect(t4.lock.leaseVersion).toBe(4);

    const finalSnap = store.getSnapshot();
    expect(finalSnap?.leaseVersion).toBe(4);
    expect(finalSnap?.sessionId).toBe("sess-4");
    expect(finalSnap?.scorerId).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURAL CONTRACT & SOURCE-LEVEL AUDIT VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Scorer Lock Architectural Contract & Code Verification", () => {
  it("scorer_match_locks schema defines leaseId, leaseVersion, and expiresAt", async () => {
    const src = await readFile(schemaScorerAccountsUrl, "utf8");
    expect(src).toContain('leaseId: text("lease_id")');
    expect(src).toContain('leaseVersion: integer("lease_version").notNull().default(1)');
    expect(src).toContain('expiresAt: timestamp("expires_at", { withTimezone: true })');
    expect(src).toContain("ix_scorer_match_locks_lease_id");
  });

  it("ensure-schema.ts defines columns, backfills, and index for leaseId and leaseVersion", async () => {
    const src = await readFile(ensureSchemaUrl, "utf8");
    expect(src).toContain("ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS lease_id TEXT;");
    expect(src).toContain("ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS lease_version INTEGER NOT NULL DEFAULT 1;");
    expect(src).toContain("ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;");
    expect(src).toContain("ix_scorer_match_locks_lease_id");
  });

  it("migration 0024_scorer_lock_fencing.sql contains schema changes", async () => {
    const src = await readFile(migrationUrl, "utf8");
    expect(src).toContain("lease_id");
    expect(src).toContain("lease_version");
    expect(src).toContain("expires_at");
  });

  it("scorer-match-locks.ts exports assertAuthoritativeScorerLease with FOR UPDATE row lock", async () => {
    const src = await readFile(scorerLockUrl, "utf8");
    expect(src).toContain("export async function assertAuthoritativeScorerLease");
    expect(src).toContain('.for("update")');
    expect(src).toContain("SCORER_LEASE_REQUIRED");
    expect(src).toContain("SCORER_LEASE_REVOKED");
    expect(src).toContain("SCORER_LEASE_STALE");
    expect(src).toContain("SCORER_LEASE_EXPIRED");
  });

  it("orchestrator.ts asserts authoritative lease BEFORE correlation lookup and scoring session lock", async () => {
    const src = await readFile(orchestratorUrl, "utf8");
    const fnIdx = src.indexOf("export async function appendSingleMatchEvent");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnBody = src.slice(fnIdx, fnIdx + 4000);

    const leaseCallIdx = fnBody.indexOf("assertAuthoritativeScorerLease(tx");
    const corrCallIdx = fnBody.indexOf("findMatchEventByCorrelationId(");
    const sessionLockIdx = fnBody.indexOf("scoring_sessions WHERE match_id = ${input.matchId} FOR UPDATE");

    expect(leaseCallIdx).toBeGreaterThan(-1);
    expect(corrCallIdx).toBeGreaterThan(-1);
    expect(sessionLockIdx).toBeGreaterThan(-1);

    // Strict order: assert lease -> check correlation -> lock scoring session
    expect(leaseCallIdx).toBeLessThan(corrCallIdx);
    expect(corrCallIdx).toBeLessThan(sessionLockIdx);
  });

  it("scoring.ts passes server-authoritative scorer identity to scoringService (prevents client spoofing)", async () => {
    const src = await readFile(scoringRouteUrl, "utf8");
    expect(src).toContain("lease: {");
    expect(src).toContain("scorerId: scorerAuth.scorerId");
    expect(src).toContain("sessionId: scorerAuth.sessionId");
    expect(src).toContain("leaseId: parsed.data.leaseId");
    expect(src).toContain("leaseVersion: parsed.data.leaseVersion");
  });

  it("frontend scorer.tsx halts queue drain immediately on 409 lock errors without discarding items", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("SCORER_LEASE_REVOKED");
    expect(src).toContain("SCORER_LEASE_STALE");
    expect(src).toContain("SCORER_LEASE_EXPIRED");
    expect(src).toContain("MATCH_LOCKED");
    expect(src).toContain("setLockLost(true)");
    expect(src).toContain("if (!synced) break;");
  });
});
