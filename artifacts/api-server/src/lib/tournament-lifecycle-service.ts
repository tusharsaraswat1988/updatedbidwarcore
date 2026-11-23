import { and, eq, inArray, sql } from "drizzle-orm";
import {
  auctionBidEventsTable,
  auctionDemoOwnedRecordsTable,
  auctionDemoSessionsTable,
  auctionPlayerEventsTable,
  auctionSessionsTable,
  auctionTimerEventsTable,
  badmintonAnalyticsTable,
  badmintonFixturesTable,
  badmintonMatchDetailsTable,
  badmintonPairStandingsTable,
  bidsTable,
  db,
  playersTable,
  scoringDlsCalculationsTable,
  scoringEventsTable,
  scoringFixturesTable,
  scoringMatchesTable,
  scoringStandingsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { lockTournamentLifecycleExclusive } from "./tournament-locks";

export class LifecycleError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "LIFECYCLE_ERROR",
  ) {
    super(message);
    this.name = "LifecycleError";
  }
}

export interface ResetDataOptions {
  tournamentId: number;
  actorLabel: string;
  actorType: "organizer" | "super_admin";
  reason?: string;
}

export interface ResetDataResult {
  ok: true;
  tournamentId: number;
  resetMode: "operational_data_reset";
  resetAt: string;
  counts: {
    playersReset: number;
    bidsDeleted: number;
    auctionEventsDeleted: number;
    cricketEventsDeleted: number;
    cricketMatchesReset: number;
    badmintonEventsDeleted: number;
    badmintonMatchesReset: number;
    badmintonAnalyticsDeleted: number;
  };
}

export interface ActivateLiveOptions {
  tournamentId: number;
  actorLabel: string;
  actorType: "organizer" | "super_admin";
  reason?: string;
}

export interface ActivateLiveResult {
  ok: true;
  tournamentId: number;
  officialActivatedAt: string;
  alreadyActivated?: boolean;
  message: string;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Internal helper to purge all trial operational data across Auction, Cricket, and Badminton
 * in a single atomic database transaction. Configuration, players, teams, and brackets are preserved.
 */
async function internalPurgeOperationalData(tx: Tx, tournamentId: number, tournament: typeof tournamentsTable.$inferSelect) {
  // ── 1. Auction Operational Reset ───────────────────────────────────────────
  // Reset non-retained players to available
  const updatePlayersResult = await tx
    .update(playersTable)
    .set({
      status: "available",
      soldPrice: null,
      teamId: null,
      unsoldCount: 0,
      soldAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(playersTable.tournamentId, tournamentId),
        sql`COALESCE(${playersTable.status}, 'available') != 'retained'`,
      ),
    );

  // Recalculate team purseUsed to only account for retained players
  const teams = await tx
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  for (const team of teams) {
    const retained = await tx
      .select({ retainedPrice: playersTable.retainedPrice })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.teamId, team.id),
          eq(playersTable.tournamentId, tournamentId),
          eq(playersTable.status, "retained"),
        ),
      );
    const retainedTotal = retained.reduce((sum, p) => sum + (p.retainedPrice ?? 0), 0);
    await tx
      .update(teamsTable)
      .set({
        purseUsed: retainedTotal,
        updatedAt: new Date(),
      })
      .where(eq(teamsTable.id, team.id));
  }

  // Delete all practice bids and lot events
  await tx.delete(bidsTable).where(eq(bidsTable.tournamentId, tournamentId));
  await tx.delete(auctionBidEventsTable).where(eq(auctionBidEventsTable.tournamentId, tournamentId));
  await tx.delete(auctionPlayerEventsTable).where(eq(auctionPlayerEventsTable.tournamentId, tournamentId));
  await tx.delete(auctionTimerEventsTable).where(eq(auctionTimerEventsTable.tournamentId, tournamentId));

  // Reset auction session to clean idle state
  await tx
    .update(auctionSessionsTable)
    .set({
      status: "idle",
      phase: "idle",
      currentPlayerId: null,
      currentPlayerStartedAt: null,
      currentBid: null,
      currentBidTeamId: null,
      timerSeconds: tournament.timerSeconds ?? 30,
      lastAction: "Operational data reset",
      revision: sql`COALESCE(${auctionSessionsTable.revision}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(auctionSessionsTable.tournamentId, tournamentId));

  // If a demo session was loaded, delete demo session records
  const demoSessions = await tx
    .select()
    .from(auctionDemoSessionsTable)
    .where(eq(auctionDemoSessionsTable.tournamentId, tournamentId));

  for (const ds of demoSessions) {
    await tx
      .delete(auctionDemoOwnedRecordsTable)
      .where(eq(auctionDemoOwnedRecordsTable.demoSessionId, ds.id));
    await tx
      .delete(auctionDemoSessionsTable)
      .where(eq(auctionDemoSessionsTable.id, ds.id));
  }

  // ── 2. Cricket Operational Reset ───────────────────────────────────────────
  const cricketMatches = await tx
    .select({ id: scoringMatchesTable.id })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "cricket"),
      ),
    );
  const cricketMatchIds = cricketMatches.map((m) => m.id);

  if (cricketMatchIds.length > 0) {
    await tx
      .delete(scoringEventsTable)
      .where(
        and(
          inArray(scoringEventsTable.matchId, cricketMatchIds),
          eq(scoringEventsTable.sportSlug, "cricket"),
        ),
      );
    await tx
      .delete(scoringDlsCalculationsTable)
      .where(inArray(scoringDlsCalculationsTable.matchId, cricketMatchIds));
    await tx
      .update(scoringMatchesTable)
      .set({
        status: "scheduled",
        currentScoreJson: null,
        matchResultJson: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(inArray(scoringMatchesTable.id, cricketMatchIds));
  }

  await tx
    .update(scoringStandingsTable)
    .set({
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      netRunRate: "0.000",
      updatedAt: new Date(),
    })
    .where(eq(scoringStandingsTable.tournamentId, tournamentId));

  await tx
    .update(scoringFixturesTable)
    .set({
      status: "scheduled",
      resultSummary: null,
      winnerTeamId: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(scoringFixturesTable.tournamentId, tournamentId));

  // ── 3. Badminton Operational Reset (FK-Safe Sequence) ──────────────────────
  // a. Collect all badminton scoringMatchIds
  const badmintonDetails = await tx
    .select({
      id: badmintonMatchDetailsTable.id,
      scoringMatchId: badmintonMatchDetailsTable.scoringMatchId,
    })
    .from(badmintonMatchDetailsTable)
    .where(eq(badmintonMatchDetailsTable.tournamentId, tournamentId));
  const badmintonMatchIds = badmintonDetails.map((b) => b.scoringMatchId);

  // b. Delete badminton scoring events
  if (badmintonMatchIds.length > 0) {
    await tx
      .delete(scoringEventsTable)
      .where(
        and(
          inArray(scoringEventsTable.matchId, badmintonMatchIds),
          eq(scoringEventsTable.sportSlug, "badminton"),
        ),
      );
  }

  // c. Delete badminton analytics
  await tx
    .delete(badmintonAnalyticsTable)
    .where(eq(badmintonAnalyticsTable.tournamentId, tournamentId));

  // d. Reset badminton pair standings
  await tx
    .update(badmintonPairStandingsTable)
    .set({
      played: 0,
      won: 0,
      lost: 0,
      marginPoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      updatedAt: new Date(),
    })
    .where(eq(badmintonPairStandingsTable.tournamentId, tournamentId));

  // e. Reset badminton match details state snapshots & toss
  await tx
    .update(badmintonMatchDetailsTable)
    .set({
      stateSnapshotJson: null,
      preMatchTossJson: null,
      masterStatsAppliedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(badmintonMatchDetailsTable.tournamentId, tournamentId));

  // f. Reset shared scoring_matches for badminton
  if (badmintonMatchIds.length > 0) {
    await tx
      .update(scoringMatchesTable)
      .set({
        status: "scheduled",
        currentScoreJson: null,
        matchResultJson: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(inArray(scoringMatchesTable.id, badmintonMatchIds));
  }

  // g. Reset badminton fixtures
  await tx
    .update(badmintonFixturesTable)
    .set({
      status: "scheduled",
      winnerRegistrationId: null,
      resultSummary: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(badmintonFixturesTable.tournamentId, tournamentId));

  return {
    cricketMatchesReset: cricketMatchIds.length,
    badmintonMatchesReset: badmintonMatchIds.length,
  };
}

/**
 * Executes a unified Reset Data operation for a tournament.
 * Cleans trial data across Auction, Cricket, and Badminton.
 * Rejects if tournament is officially activated for live production.
 */
export async function executeUnifiedResetData(
  options: ResetDataOptions,
): Promise<ResetDataResult> {
  const { tournamentId, actorLabel, actorType } = options;

  return await db.transaction(async (tx) => {
    // 1. Acquire exclusive lifecycle lock to serialize maintenance against operational mutations
    await lockTournamentLifecycleExclusive(tx, tournamentId);

    // 2. Fresh read inside transaction with row lock
    const [t] = await tx
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .for("update");

    if (!t) {
      throw new LifecycleError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
    }

    // 3. Strict guard: Reject if already officially activated
    if (t.officialActivatedAt) {
      throw new LifecycleError(
        "Tournament is officially activated for live production. Reset Data is permanently unavailable.",
        403,
        "RESET_AFTER_ACTIVATION_LOCKED",
      );
    }

    // 4. Guard: Reject completed tournaments if requested by organizer
    if (actorType === "organizer" && t.status === "completed") {
      throw new LifecycleError(
        "This tournament is completed. Reset Data is no longer available from the organizer panel.",
        403,
        "TOURNAMENT_COMPLETED",
      );
    }

    // 5. Purge operational trial data across modules
    const { cricketMatchesReset, badmintonMatchesReset } = await internalPurgeOperationalData(
      tx,
      tournamentId,
      t,
    );

    // 6. Update tournament reset statistics
    const now = new Date();
    await tx
      .update(tournamentsTable)
      .set({
        resetCount: (t.resetCount ?? 0) + 1,
        lastResetAt: now,
        lastResetBy: actorLabel,
        updatedAt: now,
      })
      .where(eq(tournamentsTable.id, tournamentId));

    return {
      ok: true,
      tournamentId,
      resetMode: "operational_data_reset",
      resetAt: now.toISOString(),
      counts: {
        playersReset: 0,
        bidsDeleted: 0,
        auctionEventsDeleted: 0,
        cricketEventsDeleted: 0,
        cricketMatchesReset,
        badmintonEventsDeleted: 0,
        badmintonMatchesReset,
        badmintonAnalyticsDeleted: 0,
      },
    };
  });
}

/**
 * Executes one-time Activate Live transition for a tournament.
 * Validates licensing and readiness, executes final automated trial data purge,
 * and seals officialActivatedAt in a single atomic transaction.
 */
export async function executeActivateLive(
  options: ActivateLiveOptions,
): Promise<ActivateLiveResult> {
  const { tournamentId, actorLabel, actorType } = options;

  return await db.transaction(async (tx) => {
    // 1. Acquire exclusive lifecycle lock
    await lockTournamentLifecycleExclusive(tx, tournamentId);

    // 2. Fresh read with row lock
    const [t] = await tx
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .for("update");

    if (!t) {
      throw new LifecycleError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
    }

    // 3. Idempotent retry check: If already officially activated, return success without duplicate action
    if (t.officialActivatedAt) {
      return {
        ok: true,
        tournamentId,
        officialActivatedAt: t.officialActivatedAt.toISOString(),
        alreadyActivated: true,
        message: "Tournament is already officially activated.",
      };
    }

    // 4. Reject completed or admin locked tournaments
    if (t.status === "completed") {
      throw new LifecycleError(
        "Completed tournaments cannot be activated for live operations.",
        409,
        "TOURNAMENT_ALREADY_COMPLETED",
      );
    }
    if (t.adminLocked) {
      throw new LifecycleError(
        "Tournament is locked by administrator and cannot be activated.",
        403,
        "TOURNAMENT_ADMIN_LOCKED",
      );
    }

    // 5. Licensing validation:
    // Requires active licenseStatus unless super_admin override
    if (t.licenseStatus !== "active" && actorType !== "super_admin") {
      throw new LifecycleError(
        "Active live license is required to activate tournament for live operations. Please request and verify your tournament license.",
        403,
        "LICENSE_REQUIRED",
      );
    }

    // 6. Execute final automated trial data cleanup
    await internalPurgeOperationalData(tx, tournamentId, t);

    // 7. Stamp official_activated_at to seal the transition
    const activationTimestamp = new Date();
    await tx
      .update(tournamentsTable)
      .set({
        officialActivatedAt: activationTimestamp,
        updatedAt: activationTimestamp,
      })
      .where(eq(tournamentsTable.id, tournamentId));

    return {
      ok: true,
      tournamentId,
      officialActivatedAt: activationTimestamp.toISOString(),
      message: "Tournament officially activated for live production.",
    };
  });
}
