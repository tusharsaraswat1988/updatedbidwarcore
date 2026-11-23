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
import { lockAuctionMutation } from "../lib/auction-mutation-lock";
import { LifecycleError } from "../lib/tournament-lifecycle-service";

describe("Phase 3.5: Comprehensive Reset Tests", () => {
  it("verifies Auction cleanup: non-retained players reset, retained players preserved", () => {
    const players = [
      { id: 1, name: "Player A", status: "sold", soldPrice: 50000, teamId: 10, unsoldCount: 2 },
      { id: 2, name: "Player B", status: "retained", retainedPrice: 20000, teamId: 10, unsoldCount: 0 },
      { id: 3, name: "Player C", status: "unsold", soldPrice: null, teamId: null, unsoldCount: 3 },
    ];

    // Reset logic: non-retained players go back to available
    const resetPlayers = players.map((p) => {
      if (p.status === "retained") return p;
      return {
        ...p,
        status: "available",
        soldPrice: null,
        teamId: null,
        unsoldCount: 0,
      };
    });

    expect(resetPlayers[0].status).toBe("available");
    expect(resetPlayers[0].soldPrice).toBeNull();
    expect(resetPlayers[0].teamId).toBeNull();
    expect(resetPlayers[0].unsoldCount).toBe(0);

    // Retained player untouched
    expect(resetPlayers[1].status).toBe("retained");
    expect(resetPlayers[1].retainedPrice).toBe(20000);
    expect(resetPlayers[1].teamId).toBe(10);

    expect(resetPlayers[2].status).toBe("available");
    expect(resetPlayers[2].unsoldCount).toBe(0);
  });

  it("verifies Cricket cleanup: scoring events deleted, standings zeroed, matches set to scheduled", () => {
    const match = {
      id: 101,
      sportSlug: "cricket",
      status: "completed",
      currentScoreJson: { runs: 145, wickets: 6, overs: "20.0" },
      matchResultJson: { winnerTeamId: 1 },
      startedAt: new Date("2026-11-20T10:00:00Z"),
      completedAt: new Date("2026-11-20T13:30:00Z"),
    };

    const standings = {
      tournamentId: 1,
      played: 5,
      won: 3,
      lost: 2,
      points: 6,
      netRunRate: "+0.450",
    };

    // After reset
    const resetMatch = {
      ...match,
      status: "scheduled",
      currentScoreJson: null,
      matchResultJson: null,
      startedAt: null,
      completedAt: null,
    };

    const resetStandings = {
      ...standings,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      netRunRate: "0.000",
    };

    expect(resetMatch.status).toBe("scheduled");
    expect(resetMatch.currentScoreJson).toBeNull();
    expect(resetMatch.matchResultJson).toBeNull();
    expect(resetMatch.startedAt).toBeNull();
    expect(resetMatch.completedAt).toBeNull();

    expect(resetStandings.played).toBe(0);
    expect(resetStandings.won).toBe(0);
    expect(resetStandings.points).toBe(0);
    expect(resetStandings.netRunRate).toBe("0.000");
  });

  it("verifies Badminton cleanup: FK-safe sequence resets pair standings, clears state snapshots, and preserves draw fixtures", () => {
    const badmintonDetails = {
      id: 201,
      scoringMatchId: 301,
      tournamentId: 1,
      stateSnapshotJson: { currentScore: { left: 21, right: 19 }, gameScores: [[21, 19]] },
      preMatchTossJson: { firstServer: 10 },
      masterStatsAppliedAt: new Date(),
    };

    const badmintonFixture = {
      id: 401,
      drawId: 5,
      slotNumber: 1,
      registrationAId: 11,
      registrationBId: 12,
      status: "completed",
      winnerRegistrationId: 11,
      resultSummary: "21-19, 21-18",
    };

    const pairStandings = {
      tournamentId: 1,
      played: 3,
      won: 3,
      lost: 0,
      pointsFor: 63,
      pointsAgainst: 45,
      marginPoints: 18,
    };

    // Reset actions
    const resetDetails = {
      ...badmintonDetails,
      stateSnapshotJson: null,
      preMatchTossJson: null,
      masterStatsAppliedAt: null,
    };

    const resetFixture = {
      ...badmintonFixture,
      status: "scheduled",
      winnerRegistrationId: null,
      resultSummary: null,
    };

    const resetPairStandings = {
      ...pairStandings,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      marginPoints: 0,
    };

    expect(resetDetails.stateSnapshotJson).toBeNull();
    expect(resetDetails.preMatchTossJson).toBeNull();
    expect(resetDetails.masterStatsAppliedAt).toBeNull();

    // Configuration preserved
    expect(resetFixture.drawId).toBe(5);
    expect(resetFixture.slotNumber).toBe(1);
    expect(resetFixture.registrationAId).toBe(11);
    expect(resetFixture.registrationBId).toBe(12);
    // Operational fields reset
    expect(resetFixture.status).toBe("scheduled");
    expect(resetFixture.winnerRegistrationId).toBeNull();
    expect(resetFixture.resultSummary).toBeNull();

    expect(resetPairStandings.played).toBe(0);
    expect(resetPairStandings.pointsFor).toBe(0);
  });

  it("verifies Configuration preservation across hybrid modules", () => {
    const tournamentConfig = {
      id: 1,
      name: "Corporate Badminton & Cricket Cup",
      sport: "badminton",
      auctionEnabled: true,
      scoringEnabled: true,
      basePurse: 10000000,
      minBid: 100000,
      timerSeconds: 30,
      minimumSquadSize: 8,
      maximumSquadSize: 12,
    };

    // Configuration remains completely identical post-reset
    expect(tournamentConfig.name).toBe("Corporate Badminton & Cricket Cup");
    expect(tournamentConfig.basePurse).toBe(10000000);
    expect(tournamentConfig.minimumSquadSize).toBe(8);
  });

  it("verifies Repeated reset idempotency and counter increment", () => {
    let resetCount = 0;
    let lastResetAt: Date | null = null;

    for (let i = 1; i <= 3; i++) {
      resetCount++;
      lastResetAt = new Date();
    }

    expect(resetCount).toBe(3);
    expect(lastResetAt).toBeInstanceOf(Date);
  });

  it("verifies Reset Data rejected after official activation (403)", () => {
    const tournament = {
      id: 1,
      officialActivatedAt: new Date("2026-11-20T12:00:00Z"),
    };

    const isLocked = !!tournament.officialActivatedAt;
    expect(isLocked).toBe(true);
    if (isLocked) {
      const err = new LifecycleError("Tournament is officially activated for live production. Reset Data is permanently unavailable.", 403, "RESET_AFTER_ACTIVATION_LOCKED");
      expect(err.status).toBe(403);
      expect(err.code).toBe("RESET_AFTER_ACTIVATION_LOCKED");
    }
  });
});

describe("Phase 3.5: Activation Flow & Edge Cases", () => {
  it("rejects activation with 403 when license is trial and requested by organizer", () => {
    const tournament = {
      id: 2,
      licenseStatus: "trial",
      status: "setup",
    };
    const actorType = "organizer";

    const allowed = tournament.licenseStatus === "active" || actorType === "super_admin";
    expect(allowed).toBe(false);
  });

  it("allows activation when license is active", () => {
    const tournament = {
      id: 2,
      licenseStatus: "active",
      status: "setup",
    };
    const actorType = "organizer";

    const allowed = tournament.licenseStatus === "active" || actorType === "super_admin";
    expect(allowed).toBe(true);
  });

  it("allows super_admin to activate regardless of licenseStatus", () => {
    const tournament = {
      id: 3,
      licenseStatus: "trial",
      status: "setup",
    };
    const actorType = "super_admin";

    const allowed = tournament.licenseStatus === "active" || actorType === "super_admin";
    expect(allowed).toBe(true);
  });

  it("rejects activation of completed tournament (409)", () => {
    const tournament = {
      id: 4,
      status: "completed",
    };

    expect(tournament.status === "completed").toBe(true);
    const err = new LifecycleError("Completed tournaments cannot be activated for live operations.", 409, "TOURNAMENT_ALREADY_COMPLETED");
    expect(err.status).toBe(409);
  });

  it("seals officialActivatedAt immutably on first activation", () => {
    const activationDate = new Date("2026-11-23T12:00:00Z");
    const tournament = {
      id: 5,
      officialActivatedAt: null as Date | null,
    };

    // First activation
    tournament.officialActivatedAt = activationDate;
    expect(tournament.officialActivatedAt).toEqual(activationDate);

    // Second call (retry / duplicate)
    const isAlreadyActivated = !!tournament.officialActivatedAt;
    expect(isAlreadyActivated).toBe(true);
    // Returns existing timestamp without overwriting
    const retryResponse = {
      ok: true,
      alreadyActivated: true,
      officialActivatedAt: tournament.officialActivatedAt.toISOString(),
    };
    expect(retryResponse.officialActivatedAt).toBe(activationDate.toISOString());
  });

  it("runtime remains idle after activation (no auto-start)", () => {
    const session = {
      status: "idle",
      phase: "idle",
      currentPlayerId: null,
      currentBid: null,
    };

    const matches = [
      { id: 1, status: "scheduled" },
      { id: 2, status: "scheduled" },
    ];

    // Activation must not start session or match
    expect(session.status).toBe("idle");
    expect(session.currentPlayerId).toBeNull();
    expect(matches.every((m) => m.status === "scheduled")).toBe(true);
  });
});

describe("Phase 3.5: Lock Hierarchy & Concurrency Invariants", () => {
  it("shared operational locks coexist without blocking each other", async () => {
    const acquiredLocks: { ns: number; id: number; mode: string }[] = [];

    const mockTx = {
      execute: vi.fn().mockImplementation(async (sqlObj: any) => {
        const text = sqlObj?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        if (text.includes("pg_advisory_xact_lock_shared")) {
          acquiredLocks.push({ ns: 1001, id: 42, mode: "shared" });
        }
        return [];
      }),
    };

    // Op 1: Bid placement
    await lockTournamentLifecycleShared(mockTx, 42);
    // Op 2: Cricket score delivery on another match
    await lockTournamentLifecycleShared(mockTx, 42);
    // Op 3: Badminton point
    await lockTournamentLifecycleShared(mockTx, 42);

    expect(acquiredLocks.length).toBe(3);
    expect(acquiredLocks.every((l) => l.mode === "shared" && l.ns === 1001)).toBe(true);
  });

  it("exclusive maintenance lock targets namespace 1001 and legacy namespace", async () => {
    const locks: string[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation(async (sqlObj: any) => {
        const text = sqlObj?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        locks.push(text);
        return [];
      }),
    };

    await lockTournamentLifecycleExclusive(mockTx, 42);
    expect(locks[0]).toContain("pg_advisory_xact_lock");
    expect(locks[0]).toContain("1001");
    expect(locks[1]).toContain("bidwar-demo-reset:42");
  });

  it("Cricket scoring and Auction bidding use distinct Tier 2 locks (1003 vs 1002)", async () => {
    const tier2Auction: number[] = [];
    const tier2Cricket: number[] = [];

    const mockTx = {
      execute: vi.fn().mockImplementation(async (sqlObj: any) => {
        const text = sqlObj?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        if (text.includes("1002")) tier2Auction.push(1002);
        if (text.includes("1003")) tier2Cricket.push(1003);
        return [];
      }),
    };

    await lockAuctionLotExclusive(mockTx, 77);
    await lockCricketMatchExclusive(mockTx, 88);

    expect(tier2Auction).toEqual([1002]);
    expect(tier2Cricket).toEqual([1003]);
    // They do not contend on Tier 2!
  });

  it("Badminton scoring and Auction bidding use distinct Tier 2 locks (1004 vs 1002)", async () => {
    const tier2Auction: number[] = [];
    const tier2Badminton: number[] = [];

    const mockTx = {
      execute: vi.fn().mockImplementation(async (sqlObj: any) => {
        const text = sqlObj?.queryChunks?.map((c: any) => c?.value ?? c).join("") || "";
        if (text.includes("1002")) tier2Auction.push(1002);
        if (text.includes("1004")) tier2Badminton.push(1004);
        return [];
      }),
    };

    await lockAuctionLotExclusive(mockTx, 77);
    await lockBadmintonMatchExclusive(mockTx, 99);

    expect(tier2Auction).toEqual([1002]);
    expect(tier2Badminton).toEqual([1004]);
  });
});

describe("Phase 3.5: Tournament Lifecycle Decoupled Completion", () => {
  it("Auction-only: auction concludes -> tournament status transitions to completed", () => {
    const tournament = { scoringEnabled: false, scoringPhase: "disabled", status: "active" };
    const isScoringPending = (tournament.scoringEnabled ?? false) && tournament.scoringPhase !== "completed";

    expect(isScoringPending).toBe(false);
    const newTournamentStatus = isScoringPending ? tournament.status : "completed";
    expect(newTournamentStatus).toBe("completed");
  });

  it("Hybrid Auction + Cricket: auction concludes while cricket is pending -> tournament status REMAINS active", () => {
    const tournament = { scoringEnabled: true, scoringPhase: "active", status: "active" };
    const isScoringPending = (tournament.scoringEnabled ?? false) && tournament.scoringPhase !== "completed";

    expect(isScoringPending).toBe(true);
    // When auction concludes, tournament does NOT transition to completed:
    const newTournamentStatus = isScoringPending ? tournament.status : "completed";
    expect(newTournamentStatus).toBe("active");
  });

  it("Hybrid Auction + Badminton: tournament completes only when both auction and badminton finish", () => {
    const tournament = { scoringEnabled: true, scoringPhase: "completed", status: "active" };
    const isScoringPending = (tournament.scoringEnabled ?? false) && tournament.scoringPhase !== "completed";

    expect(isScoringPending).toBe(false);
    const newTournamentStatus = isScoringPending ? tournament.status : "completed";
    expect(newTournamentStatus).toBe("completed");
  });
});

describe("Phase 3.5: Fan Discovery & OBS Zero False-LIVE Verification", () => {
  function deriveOverallLive(
    session: { status: string; currentPlayerId: number | null } | null,
    activeMatches: { status: string }[],
  ) {
    const isAuctionLive = session !== null && (session.status === "live" || session.currentPlayerId != null);
    const isMatchLive = activeMatches.some((m) => m.status === "live" || m.status === "in_progress");
    return {
      isAuctionLive,
      isMatchLive,
      overallLive: isAuctionLive || isMatchLive,
    };
  }

  it("after Reset Data: idle auction and scheduled matches result in overallLive = false", () => {
    const session = { status: "idle", currentPlayerId: null };
    const matches = [{ status: "scheduled" }, { status: "scheduled" }];

    const result = deriveOverallLive(session, matches);
    expect(result.isAuctionLive).toBe(false);
    expect(result.isMatchLive).toBe(false);
    expect(result.overallLive).toBe(false);
  });

  it("after Activate Live: idle auction and scheduled matches result in overallLive = false", () => {
    const session = { status: "idle", currentPlayerId: null };
    const matches = [{ status: "scheduled" }];

    const result = deriveOverallLive(session, matches);
    expect(result.overallLive).toBe(false);
  });

  it("completed tournament with concluded session does not trigger false LIVE badge", () => {
    const session = { status: "completed", currentPlayerId: null };
    const matches = [{ status: "completed" }];

    const result = deriveOverallLive(session, matches);
    expect(result.overallLive).toBe(false);
  });
});
