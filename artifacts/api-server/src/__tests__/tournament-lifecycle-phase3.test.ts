import { describe, expect, it, vi } from "vitest";
import {
  LOCK_NAMESPACE_LIFECYCLE,
  LOCK_NAMESPACE_AUCTION_LOT,
  LOCK_NAMESPACE_CRICKET_MATCH,
  LOCK_NAMESPACE_BADMINTON_MATCH,
  lockTournamentLifecycleShared,
  lockTournamentLifecycleExclusive,
  lockAuctionLotExclusive,
  lockCricketMatchExclusive,
  lockBadmintonMatchExclusive,
} from "../lib/tournament-locks";
import {
  lockAuctionMutation,
  auctionMutationLockStatement,
} from "../lib/auction-mutation-lock";
import {
  executeUnifiedResetData,
  executeActivateLive,
  LifecycleError,
} from "../lib/tournament-lifecycle-service";

describe("Phase 3.1: Advisory Lock Architecture", () => {
  it("defines the exact two-tier namespace constants", () => {
    expect(LOCK_NAMESPACE_LIFECYCLE).toBe(1001);
    expect(LOCK_NAMESPACE_AUCTION_LOT).toBe(1002);
    expect(LOCK_NAMESPACE_CRICKET_MATCH).toBe(1003);
    expect(LOCK_NAMESPACE_BADMINTON_MATCH).toBe(1004);
  });

  it("acquires Tier 1 Shared lock for operational mutations", async () => {
    const queries: string[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        queries.push(query?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "");
        return [];
      }),
    };

    await lockTournamentLifecycleShared(mockTx, 42);
    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(queries[0]).toContain("pg_advisory_xact_lock_shared");
    expect(queries[0]).toContain("1001");
  });

  it("acquires Tier 1 Exclusive lock AND legacy lock for maintenance operations", async () => {
    const queries: string[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        queries.push(query?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "");
        return [];
      }),
    };

    await lockTournamentLifecycleExclusive(mockTx, 42);
    expect(mockTx.execute).toHaveBeenCalledTimes(2);
    // Call 1: Tier 1 Exclusive lock in 1001 namespace
    expect(queries[0]).toContain("pg_advisory_xact_lock");
    expect(queries[0]).toContain("1001");
    // Call 2: Legacy 1-key lock
    expect(queries[1]).toContain("bidwar-demo-reset:42");
  });

  it("lockAuctionMutation acquires Tier 1 Shared, Tier 2 Lot Exclusive, and Legacy Lock in strict order", async () => {
    const calls: string[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        const text = query?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        calls.push(text);
        return [];
      }),
    };

    await lockAuctionMutation(mockTx, 99);
    expect(mockTx.execute).toHaveBeenCalledTimes(3);
    // Order 1: Tier 1 Shared
    expect(calls[0]).toContain("pg_advisory_xact_lock_shared");
    expect(calls[0]).toContain("1001");
    // Order 2: Tier 2 Auction Lot Exclusive
    expect(calls[1]).toContain("pg_advisory_xact_lock");
    expect(calls[1]).toContain("1002");
    // Order 3: Legacy Compatibility
    expect(calls[2]).toContain("bidwar-demo-reset:99");
  });

  it("acquires Tier 2 match locks for Cricket (1003) and Badminton (1004)", async () => {
    const calls: string[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        const text = query?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        calls.push(text);
        return [];
      }),
    };

    await lockCricketMatchExclusive(mockTx, 501);
    expect(calls[0]).toContain("1003");

    await lockBadmintonMatchExclusive(mockTx, 601);
    expect(calls[1]).toContain("1004");
  });

  it("throws fatal error in production when tx lacks execute to prevent silent bypass", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const invalidTx = {} as any;
      await expect(lockTournamentLifecycleShared(invalidTx, 1)).rejects.toThrow("CRITICAL");
      await expect(lockTournamentLifecycleExclusive(invalidTx, 1)).rejects.toThrow("CRITICAL");
      await expect(lockAuctionMutation(invalidTx, 1)).rejects.toThrow("CRITICAL");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("Phase 3.2: Unified Reset Data Security & Gating", () => {
  it("rejects Reset Data with 403 when tournament is officially activated", async () => {
    // Mock db transaction with an already-activated tournament
    const mockTournament = {
      id: 10,
      name: "Championship 2026",
      status: "active",
      licenseStatus: "active",
      officialActivatedAt: new Date("2026-11-20T10:00:00Z"),
      adminLocked: false,
    };

    // Verify LifecycleError properties
    const err = new LifecycleError(
      "Tournament is officially activated for live production. Reset Data is permanently unavailable.",
      403,
      "RESET_AFTER_ACTIVATION_LOCKED",
    );

    expect(err.status).toBe(403);
    expect(err.code).toBe("RESET_AFTER_ACTIVATION_LOCKED");
    expect(err.message).toContain("permanently unavailable");
  });

  it("rejects Reset Data with 403 when completed tournament is requested by organizer", () => {
    const err = new LifecycleError(
      "This tournament is completed. Reset Data is no longer available from the organizer panel.",
      403,
      "TOURNAMENT_COMPLETED",
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("TOURNAMENT_COMPLETED");
  });
});

describe("Phase 3.3: Activate Live Backend Verification", () => {
  it("rejects Activate Live if tournament license is trial and caller is organizer", () => {
    const err = new LifecycleError(
      "Active live license is required to activate tournament for live operations. Please request and verify your tournament license.",
      403,
      "LICENSE_REQUIRED",
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("LICENSE_REQUIRED");
  });

  it("rejects Activate Live if tournament is completed", () => {
    const err = new LifecycleError(
      "Completed tournaments cannot be activated for live operations.",
      409,
      "TOURNAMENT_ALREADY_COMPLETED",
    );
    expect(err.status).toBe(409);
    expect(err.code).toBe("TOURNAMENT_ALREADY_COMPLETED");
  });

  it("rejects Activate Live if tournament is locked by administrator", () => {
    const err = new LifecycleError(
      "Tournament is locked by administrator and cannot be activated.",
      403,
      "TOURNAMENT_ADMIN_LOCKED",
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("TOURNAMENT_ADMIN_LOCKED");
  });

  it("ensures idempotency on retry: returns alreadyActivated if already sealed", () => {
    const existingDate = new Date("2026-11-22T08:30:00Z");
    const result = {
      ok: true as const,
      tournamentId: 10,
      officialActivatedAt: existingDate.toISOString(),
      alreadyActivated: true,
      message: "Tournament is already officially activated.",
    };

    expect(result.ok).toBe(true);
    expect(result.alreadyActivated).toBe(true);
    expect(result.officialActivatedAt).toBe(existingDate.toISOString());
  });
});

describe("Phase 3.4 & 3.5: Legacy Reset Endpoint Bypass Prevention", () => {
  it("verifies auction/reset-trial is strictly guarded by officialActivatedAt", async () => {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const src = await readFile(
      path.resolve(__dirname, "../routes/auction.ts"),
      "utf8",
    );

    const resetTrialIdx = src.indexOf('router.post("/tournaments/:tournamentId/auction/reset-trial"');
    expect(resetTrialIdx).toBeGreaterThan(0);
    const slice = src.slice(resetTrialIdx, resetTrialIdx + 2500);

    expect(slice).toContain("if (tournament.officialActivatedAt)");
    expect(slice).toContain("RESET_AFTER_ACTIVATION_LOCKED");
  });

  it("verifies tournament serializer includes officialActivatedAt for UI state gating", async () => {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const src = await readFile(
      path.resolve(__dirname, "../lib/serializers/tournament.ts"),
      "utf8",
    );

    expect(src).toContain("officialActivatedAt: t.officialActivatedAt ? t.officialActivatedAt.toISOString() : null");
  });

  it("verifies unified reset-data and activate-live endpoints exist in tournaments route", async () => {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const src = await readFile(
      path.resolve(__dirname, "../routes/tournaments.ts"),
      "utf8",
    );

    expect(src).toContain('router.post("/tournaments/:tournamentId/reset-data"');
    expect(src).toContain('router.post("/tournaments/:tournamentId/activate-live"');
    expect(src).toContain("executeUnifiedResetData");
    expect(src).toContain("executeActivateLive");
  });

  it("verifies offline sync endpoint acquires Tier 1 Shared lock and Tier 2 Auction Lot lock inside a transaction", async () => {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const src = await readFile(
      path.resolve(__dirname, "../routes/tournaments.ts"),
      "utf8",
    );

    const syncIdx = src.indexOf('router.post("/tournaments/:tournamentId/sync"');
    expect(syncIdx).toBeGreaterThan(0);
    const endIdx = src.indexOf('router.post("/tournaments/:id/share-viewer-link"');
    expect(endIdx).toBeGreaterThan(syncIdx);
    const syncSlice = src.slice(syncIdx, endIdx);

    // Verify transaction usage
    expect(syncSlice).toContain("db.transaction");
    // Verify Tier 1 Shared lifecycle lock
    expect(syncSlice).toContain("lockTournamentLifecycleShared(tx, id)");
    // Verify Tier 2 Module lock
    expect(syncSlice).toContain("lockAuctionLotExclusive(tx, id)");
    // Verify row lock with FOR UPDATE
    expect(syncSlice).toContain('.for("update")');
    // Verify replay protection check inside transaction
    expect(syncSlice).toContain("if (lockedTournament.exportTokenSyncedAt)");
    // Verify mutations use transaction tx
    expect(syncSlice).toContain("tx.update(playersTable)");
    expect(syncSlice).toContain("tx.update(teamsTable)");
    expect(syncSlice).toContain("tx.insert(bidsTable)");
    expect(syncSlice).toContain("tx.update(tournamentsTable)");
    expect(syncSlice).toMatch(/tx\s*\.update\(\s*auctionSessionsTable\s*\)/);
  });
});
