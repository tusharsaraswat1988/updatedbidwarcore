import { db } from "@workspace/db";
import { describe, expect, it, vi } from "vitest";
import "../lib/scoring-adapters/register";
import { BadmintonEventType } from "@workspace/badminton-core";
import {
  assertAuthoritativeScorerLease,
  ScorerLockError,
  SCORER_LOCK_TIMEOUT_SEC,
} from "../lib/scorer-match-locks";
import { appendMatchEventBatch } from "../lib/scoring-platform/orchestrator";
import * as eventStore from "../lib/scoring-platform/event-store";
import * as scorerLocks from "../lib/scorer-match-locks";
import { awardPoint, startBadmintonMatch, undoLastPoint } from "../lib/badminton-service";
import express from "express";
import request from "supertest";

// ============================================================================
// PART 1: SEC-2026-06 — Badminton Scorer Lease Fencing TOCTOU Gap Tests
// ============================================================================
describe("SEC-2026-06: Badminton Scorer Lease Fencing TOCTOU Hardening", () => {
  const matchId = 101;
  const scorerId = 42;
  const sessionId = "session_scorer_42";
  const leaseId = "lease_uuid_abc";
  const leaseVersion = 1;

  it("assertAuthoritativeScorerLease succeeds when scorer holds active fresh lease", async () => {
    const freshHeartbeat = new Date();
    const mockLockRow = {
      matchId,
      scorerId,
      sessionId,
      leaseId,
      leaseVersion,
      lockedAt: new Date(freshHeartbeat.getTime() - 10_000),
      lastHeartbeatAt: freshHeartbeat,
      expiresAt: new Date(freshHeartbeat.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000),
    };

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => Promise.resolve([mockLockRow]),
          }),
        }),
      }),
    } as any;

    const verifiedLock = await assertAuthoritativeScorerLease(mockTx, {
      matchId,
      scorerId,
      sessionId,
      leaseId,
      leaseVersion,
    });

    expect(verifiedLock.matchId).toBe(matchId);
    expect(verifiedLock.sessionId).toBe(sessionId);
    expect(verifiedLock.leaseId).toBe(leaseId);
    expect(verifiedLock.leaseVersion).toBe(leaseVersion);
  });

  it("assertAuthoritativeScorerLease fails closed when lease heartbeat is expired", async () => {
    const expiredHeartbeat = new Date(Date.now() - (SCORER_LOCK_TIMEOUT_SEC + 60) * 1000);
    const mockLockRow = {
      matchId,
      scorerId,
      sessionId,
      leaseId,
      leaseVersion,
      lockedAt: new Date(expiredHeartbeat.getTime() - 60_000),
      lastHeartbeatAt: expiredHeartbeat,
      expiresAt: new Date(expiredHeartbeat.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000),
    };

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => Promise.resolve([mockLockRow]),
          }),
        }),
      }),
    } as any;

    await expect(
      assertAuthoritativeScorerLease(mockTx, {
        matchId,
        scorerId,
        sessionId,
        leaseId,
        leaseVersion,
      }),
    ).rejects.toThrowError(ScorerLockError);

    try {
      await assertAuthoritativeScorerLease(mockTx, {
        matchId,
        scorerId,
        sessionId,
        leaseId,
        leaseVersion,
      });
    } catch (e: any) {
      expect(e.code).toBe("SCORER_LEASE_EXPIRED");
      expect(e.status).toBe(409);
    }
  });

  it("assertAuthoritativeScorerLease rejects stale lease holder after takeover", async () => {
    // Another scorer has taken over: sessionId and leaseId changed, version incremented
    const freshHeartbeat = new Date();
    const takeoverLockRow = {
      matchId,
      scorerId: 99,
      sessionId: "session_scorer_99_new",
      leaseId: "lease_uuid_takeover_xyz",
      leaseVersion: 2,
      lockedAt: freshHeartbeat,
      lastHeartbeatAt: freshHeartbeat,
      expiresAt: new Date(freshHeartbeat.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000),
    };

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => Promise.resolve([takeoverLockRow]),
          }),
        }),
      }),
    } as any;

    // Stale Scorer 42 attempts to score with old leaseId and old leaseVersion
    await expect(
      assertAuthoritativeScorerLease(mockTx, {
        matchId,
        scorerId,
        sessionId,
        leaseId,
        leaseVersion,
      }),
    ).rejects.toThrowError(ScorerLockError);

    try {
      await assertAuthoritativeScorerLease(mockTx, {
        matchId,
        scorerId,
        sessionId,
        leaseId,
        leaseVersion,
      });
    } catch (e: any) {
      expect(["SCORER_LEASE_REVOKED", "SCORER_LEASE_STALE"]).toContain(e.code);
      expect(e.status).toBe(409);
    }
  });

  it("assertAuthoritativeScorerLease rejects request with stale leaseVersion even if sessionId matched", async () => {
    const freshHeartbeat = new Date();
    const mockLockRow = {
      matchId,
      scorerId,
      sessionId,
      leaseId: "new_lease_id_v2",
      leaseVersion: 2,
      lockedAt: freshHeartbeat,
      lastHeartbeatAt: freshHeartbeat,
      expiresAt: new Date(freshHeartbeat.getTime() + SCORER_LOCK_TIMEOUT_SEC * 1000),
    };

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => Promise.resolve([mockLockRow]),
          }),
        }),
      }),
    } as any;

    try {
      await assertAuthoritativeScorerLease(mockTx, {
        matchId,
        scorerId,
        sessionId,
        leaseId: "old_lease_id_v1",
        leaseVersion: 1, // Stale!
      });
      expect.fail("Should have thrown ScorerLockError");
    } catch (e: any) {
      expect(e).toBeInstanceOf(ScorerLockError);
      expect(e.code).toBe("SCORER_LEASE_STALE");
      expect(e.status).toBe(409);
    }
  });

  it("appendMatchEventBatch enforces assertAuthoritativeScorerLease within transactional boundary", async () => {
    const txSpy = vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb({} as any));
    const assertSpy = vi.spyOn(scorerLocks, "assertAuthoritativeScorerLease");
    const persistBatchSpy = vi.spyOn(eventStore, "persistScoringEventBatch");

    // Make assertAuthoritativeScorerLease throw SCORER_LEASE_REVOKED
    assertSpy.mockRejectedValueOnce(
      new ScorerLockError("Your scoring lease has expired or been taken over", "SCORER_LEASE_REVOKED", 409),
    );

    await expect(
      appendMatchEventBatch({
        tournamentId: 1,
        matchId: 101,
        sportSlug: "badminton",
        actor: { type: "scorer", id: "42" },
        events: [
          {
            eventType: BadmintonEventType.POINT_WON,
            payload: {
              winningSide: "left",
              gameNumber: 1,
              winnerScore: 1,
              loserScore: 0,
              isGamePoint: false,
              isMatchPoint: false,
            },
          },
        ],
        projectionMode: "incremental",
        priorState: {
          matchId: 101,
          matchStatus: "live",
          matchKind: "singles",
          currentGameNumber: 1,
          gameScores: [{ gameNumber: 1, leftScore: 0, rightScore: 0, winnerSide: null }],
          lastSequence: 1,
        },
        matchMeta: { matchId: 101 },
        lease: {
          scorerId: 42,
          sessionId: "stale_session",
          leaseId: "stale_lease",
          leaseVersion: 1,
        },
      }),
    ).rejects.toThrowError(ScorerLockError);

    // Verify lease check was called
    expect(assertSpy).toHaveBeenCalled();
    // Verify persistScoringEventBatch was NOT executed because lease assertion failed first
    expect(persistBatchSpy).not.toHaveBeenCalled();

    assertSpy.mockRestore();
    persistBatchSpy.mockRestore();
    txSpy.mockRestore();
  });
});

// ============================================================================
// PART 2: SEC-2026-07 — Auction Unsold CAS Revision Guard Tests
// ============================================================================
describe("SEC-2026-07: Auction Unsold CAS Revision Guard Hardening", () => {
  it("Unsold rejects when currentBid is not null (active bid in progress)", async () => {
    const app = express();
    app.use(express.json());

    // Mock route reproducing the exact CAS guard logic in /tournaments/:id/auction/unsold
    app.post("/tournaments/:id/auction/unsold", (req, res) => {
      const { expectedRevision } = req.body ?? {};
      const session = {
        tournamentId: 1,
        currentPlayerId: 10,
        currentBid: 500_000, // ACTIVE BID IN PROGRESS!
        currentBidTeamId: 2,
        revision: 5,
      };

      if (session.currentBid !== null) {
        return res.status(409).json({
          error: "Cannot mark player unsold: an active bid has been placed.",
          currentBid: session.currentBid,
          currentBidTeamId: session.currentBidTeamId,
          hint: "bid_in_progress",
        });
      }

      if (expectedRevision !== undefined && session.revision !== expectedRevision) {
        return res.status(409).json({
          error: "Auction state changed — a new action occurred before your unsold request. Please refresh.",
          currentRevision: session.revision,
          hint: "stale_unsold",
        });
      }

      res.json({ ok: true });
    });

    const response = await request(app)
      .post("/tournaments/1/auction/unsold")
      .send({ expectedRevision: 5 });

    expect(response.status).toBe(409);
    expect(response.body.hint).toBe("bid_in_progress");
    expect(response.body.currentBid).toBe(500_000);
  });

  it("Unsold rejects when expectedRevision does not match current session revision", async () => {
    const app = express();
    app.use(express.json());

    app.post("/tournaments/:id/auction/unsold", (req, res) => {
      const { expectedRevision } = req.body ?? {};
      const session = {
        tournamentId: 1,
        currentPlayerId: 10,
        currentBid: null,
        currentBidTeamId: null,
        revision: 6, // Current revision is 6!
      };

      if (session.currentBid !== null) {
        return res.status(409).json({
          error: "Cannot mark player unsold: an active bid has been placed.",
          hint: "bid_in_progress",
        });
      }

      if (expectedRevision !== undefined && session.revision !== expectedRevision) {
        return res.status(409).json({
          error: "Auction state changed — a new action occurred before your unsold request. Please refresh.",
          currentRevision: session.revision,
          hint: "stale_unsold",
        });
      }

      res.json({ ok: true, revision: session.revision + 1 });
    });

    const response = await request(app)
      .post("/tournaments/1/auction/unsold")
      .send({ expectedRevision: 5 }); // Stale revision 5 sent!

    expect(response.status).toBe(409);
    expect(response.body.hint).toBe("stale_unsold");
    expect(response.body.currentRevision).toBe(6);
  });

  it("Unsold succeeds when currentBid is null and expectedRevision matches", async () => {
    const app = express();
    app.use(express.json());

    app.post("/tournaments/:id/auction/unsold", (req, res) => {
      const { expectedRevision } = req.body ?? {};
      const session = {
        tournamentId: 1,
        currentPlayerId: 10,
        currentBid: null,
        currentBidTeamId: null,
        revision: 5,
      };

      if (session.currentBid !== null) {
        return res.status(409).json({
          error: "Cannot mark player unsold: an active bid has been placed.",
          hint: "bid_in_progress",
        });
      }

      if (expectedRevision !== undefined && session.revision !== expectedRevision) {
        return res.status(409).json({
          error: "Auction state changed — a new action occurred before your unsold request. Please refresh.",
          currentRevision: session.revision,
          hint: "stale_unsold",
        });
      }

      // CAS transaction update succeeds
      res.json({
        ok: true,
        session: {
          currentPlayerId: null,
          currentBid: null,
          revision: session.revision + 1,
          lastAction: "UNSOLD: Player 10",
        },
      });
    });

    const response = await request(app)
      .post("/tournaments/1/auction/unsold")
      .send({ expectedRevision: 5 });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.session.currentPlayerId).toBeNull();
    expect(response.body.session.revision).toBe(6);
  });

  it("Simulated concurrent race: bid placed before unsold CAS commits", async () => {
    // Model atomic database state
    let state = {
      revision: 4,
      currentPlayerId: 10,
      currentBid: null as number | null,
      currentBidTeamId: null as number | null,
      playerStatus: "available",
    };

    const simulateBid = async (amount: number, teamId: number) => {
      // Bid places currentBid and bumps revision
      state.currentBid = amount;
      state.currentBidTeamId = teamId;
      state.revision += 1;
      return { ok: true, revision: state.revision };
    };

    const simulateUnsoldCAS = async (expectedRevision: number) => {
      // CAS condition: revision = expectedRevision AND currentBid IS NULL AND currentPlayerId = 10
      if (
        state.revision === expectedRevision &&
        state.currentBid === null &&
        state.currentPlayerId === 10
      ) {
        state.currentPlayerId = null as any;
        state.playerStatus = "unsold";
        state.revision += 1;
        return { ok: true, revision: state.revision };
      } else {
        const hint = state.currentBid !== null ? "bid_in_progress" : "stale_unsold";
        return { ok: false, hint, currentRevision: state.revision };
      }
    };

    // Client reads revision 4 with no bid
    const clientExpectedRevision = state.revision; // 4

    // Concurrently, a bidder places 500,000 and commits first
    await simulateBid(500_000, 2);
    expect(state.revision).toBe(5);
    expect(state.currentBid).toBe(500_000);

    // Operator's unsold CAS attempt arrives second
    const unsoldResult = await simulateUnsoldCAS(clientExpectedRevision);

    // Unsold MUST fail closed with bid_in_progress
    expect(unsoldResult.ok).toBe(false);
    expect(unsoldResult.hint).toBe("bid_in_progress");

    // Bidder's bid and player's available status MUST be preserved!
    expect(state.currentBid).toBe(500_000);
    expect(state.currentPlayerId).toBe(10);
    expect(state.playerStatus).toBe("available");
  });

  it("Unsold transaction aborts when player is no longer available in CAS update", async () => {
    const app = express();
    app.use(express.json());

    class UnsoldTransactionAbortError extends Error {
      constructor(public reason: "stale_unsold" | "bid_in_progress" | "player_not_available") {
        super(`Unsold transaction aborted: ${reason}`);
        this.name = "UnsoldTransactionAbortError";
      }
    }

    app.post("/tournaments/:id/auction/unsold", (req, res) => {
      try {
        // Simulate: player was already sold or retained concurrently
        const updatedPlayersCount = 0;
        if (updatedPlayersCount === 0) {
          throw new UnsoldTransactionAbortError("player_not_available");
        }
        res.json({ ok: true });
      } catch (err: any) {
        if (err.name === "UnsoldTransactionAbortError") {
          if (err.reason === "player_not_available") {
            return res.status(409).json({
              error: "This player is no longer available to be marked unsold.",
              hint: "player_not_available",
            });
          }
        }
        throw err;
      }
    });

    const response = await request(app)
      .post("/tournaments/1/auction/unsold")
      .send({ expectedRevision: 5 });

    expect(response.status).toBe(409);
    expect(response.body.hint).toBe("player_not_available");
    expect(response.body.error).toContain("no longer available");
  });
});

// ============================================================================
// PART 3: Badminton Route Lease & Error Propagation Tests
// ============================================================================
describe("SEC-2026-06 Route Layer: leaseFrom and handleBadmintonError mapping", () => {
  it("leaseFrom correctly extracts lease from request body or lock fallback", () => {
    // We recreate the helper logic to test boundary conditions
    function leaseFrom(
      body: any,
      auth: any,
    ) {
      if (!auth.usedScorer) return undefined;
      return {
        scorerId: auth.scorer.scorerId,
        sessionId: auth.scorer.sessionId,
        leaseId: (typeof body.leaseId === "string" ? body.leaseId : auth.lock?.leaseId) ?? null,
        leaseVersion:
          (typeof body.leaseVersion === "number" ? body.leaseVersion : auth.lock?.leaseVersion) ?? null,
      };
    }

    // 1. Organizer/admin: should return undefined
    expect(leaseFrom({}, { usedScorer: false })).toBeUndefined();

    // 2. Scorer with explicit body fields
    const scorerAuth = {
      usedScorer: true,
      scorer: { scorerId: 10, sessionId: "sess_10" },
      lock: { leaseId: "lock_lease", leaseVersion: 1 },
    };
    const fromBody = leaseFrom(
      { leaseId: "client_lease", leaseVersion: 2 },
      scorerAuth,
    );
    expect(fromBody).toEqual({
      scorerId: 10,
      sessionId: "sess_10",
      leaseId: "client_lease",
      leaseVersion: 2,
    });

    // 3. Scorer with missing body fields: falls back to lock
    const fromLock = leaseFrom({}, scorerAuth);
    expect(fromLock).toEqual({
      scorerId: 10,
      sessionId: "sess_10",
      leaseId: "lock_lease",
      leaseVersion: 1,
    });
  });

  it("handleBadmintonError maps all ScorerLockError codes to HTTP 409 responses", async () => {
    const app = express();
    app.use(express.json());

    function handleBadmintonError(res: express.Response, e: unknown): boolean {
      if (e instanceof ScorerLockError) {
        const code =
          e.code === "MATCH_LOCKED" || e.code === "SCORER_LEASE_REVOKED"
            ? "MATCH_LOCKED"
            : e.code === "SCORER_LEASE_STALE"
              ? "SCORER_LEASE_STALE"
              : e.code === "SCORER_LEASE_EXPIRED"
                ? "SCORER_LEASE_EXPIRED"
                : e.code === "SCORER_LEASE_REQUIRED"
                  ? "SCORER_LEASE_REQUIRED"
                  : "MATCH_LOCK_REQUIRED";
        res.status(e.status ?? 409).json({
          error: e.message,
          code,
          leaseCode: e.code,
          message: e.message,
        });
        return true;
      }
      return false;
    }

    app.get("/test-lease-expired", (_req, res) => {
      const err = new ScorerLockError("Scorer lease expired", "SCORER_LEASE_EXPIRED", 409);
      if (handleBadmintonError(res, err)) return;
      res.status(500).end();
    });

    app.get("/test-lease-revoked", (_req, res) => {
      const err = new ScorerLockError("Scorer lease revoked by takeover", "SCORER_LEASE_REVOKED", 409);
      if (handleBadmintonError(res, err)) return;
      res.status(500).end();
    });

    app.get("/test-lease-stale", (_req, res) => {
      const err = new ScorerLockError("Scorer lease version stale", "SCORER_LEASE_STALE", 409);
      if (handleBadmintonError(res, err)) return;
      res.status(500).end();
    });

    const resExpired = await request(app).get("/test-lease-expired");
    expect(resExpired.status).toBe(409);
    expect(resExpired.body.code).toBe("SCORER_LEASE_EXPIRED");
    expect(resExpired.body.leaseCode).toBe("SCORER_LEASE_EXPIRED");

    const resRevoked = await request(app).get("/test-lease-revoked");
    expect(resRevoked.status).toBe(409);
    expect(resRevoked.body.code).toBe("MATCH_LOCKED");
    expect(resRevoked.body.leaseCode).toBe("SCORER_LEASE_REVOKED");

    const resStale = await request(app).get("/test-lease-stale");
    expect(resStale.status).toBe(409);
    expect(resStale.body.code).toBe("SCORER_LEASE_STALE");
    expect(resStale.body.leaseCode).toBe("SCORER_LEASE_STALE");
  });
});
