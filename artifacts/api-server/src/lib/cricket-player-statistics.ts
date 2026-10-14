/**
 * Cricket player statistics.
 *
 * Source of truth: ball events, projected to a scorecard, then stored as one
 * ledger row per player per innings (`scoring_match_player_stats`).
 *
 * Tournament and career rows in `player_statistics` are a cache of that ledger
 * for resolved canonical players. They are replaced, never incremented.
 *
 * Writers take one transaction-scoped advisory lock so two completions,
 * reconciles, or repairs cannot persist a stale snapshot over a newer one.
 * A failed transaction rolls back the ledger replacement and the cache together.
 * Retrying the same match is a no-op once the ledger is unchanged.
 *
 * Only `sport = 'cricket'` cache rows are written. Badminton and other sports
 * stay untouched. Rows that do not resolve to exactly one canonical player are
 * left out of the cache and logged; they are not guessed by name.
 *
 * After this migration deploys, run organizer reconcile (or
 * `rebuildCricketPlayerStatistics`) once. That rewrites the cache from completed
 * scorecards. Until then, career leaderboards can still show pre-fix totals.
 * Player profiles read the ledger directly, so they are correct without that pass.
 */

import { db } from "@workspace/db";
import {
  playerStatisticsTable,
  playerTeamAssignmentsTable,
  scoringEventsTable,
  scoringMatchPlayerStatsTable,
  scoringMatchSquadsTable,
  scoringMatchesTable,
  type BowlingStatsJson,
  type BattingStatsJson,
} from "@workspace/db";
import {
  aggregateTournamentPlayerStats,
  buildCanonicalCricketAggregates,
  buildCricketScorecardFromEvents,
  identityKey,
  planCricketStatisticWrites,
  resolveOpaquePlayerIdentities,
  scorecardToPlayerStats,
  type AssignmentSnapshot,
  type BattingCardRow,
  type CanonicalLedgerRow,
  type CricketCareerStats,
  type MatchAppearance,
  type PlayerIdentityResolution,
  type ScopedCricketAggregate,
  type ScoringEventEnvelope,
  type StatisticWritePlan,
  type TournamentPlayerAggregate,
} from "@workspace/scoring-core";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { logger } from "./logger";

const CRICKET_STATS_LOCK = "bidwar:cricket-player-statistics:v1";
const CRICKET_SPORT = "cricket";

type StatsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type StatRow = typeof scoringMatchPlayerStatsTable.$inferSelect;

export type CanonicalCricketStatsView = {
  career: CricketCareerStats | null;
  tournaments: Array<{ tournamentId: number; stats: CricketCareerStats }>;
  excluded: StatisticWritePlan["excluded"];
};

async function lockCricketStatistics(tx: StatsTx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CRICKET_STATS_LOCK}))`);
}

function envelope(row: typeof scoringEventsTable.$inferSelect): ScoringEventEnvelope {
  return {
    id: row.id,
    matchId: row.matchId,
    tournamentId: row.tournamentId,
    fixtureId: row.fixtureId,
    sportSlug: row.sportSlug as "cricket",
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    sequence: row.sequence,
    occurredAt: row.occurredAt,
    actorType: row.actorType as ScoringEventEnvelope["actorType"],
    actorId: row.actorId,
    correlationId: row.correlationId,
    causationId: row.causationId,
    payload: row.payloadJson ?? {},
  };
}

function assignmentsToSnapshots(
  rows: Array<{
    tournamentId: number | null;
    opaquePlayerId: number | null;
    masterPlayerId: string;
    isActive: boolean;
    assignedAt: Date;
  }>,
): AssignmentSnapshot[] {
  const snapshots: AssignmentSnapshot[] = [];
  for (const row of rows) {
    if (row.tournamentId == null || row.opaquePlayerId == null) continue;
    snapshots.push({
      tournamentId: row.tournamentId,
      opaquePlayerId: row.opaquePlayerId,
      masterPlayerId: row.masterPlayerId,
      isActive: row.isActive,
      assignedAtMs: row.assignedAt.getTime(),
    });
  }
  return snapshots;
}

async function loadAssignments(
  tx: StatsTx,
  tournamentIds?: number[],
): Promise<AssignmentSnapshot[]> {
  if (tournamentIds && tournamentIds.length === 0) return [];
  const rows = await tx
    .select({
      tournamentId: playerTeamAssignmentsTable.tournamentId,
      opaquePlayerId: playerTeamAssignmentsTable.auctionPlayerId,
      masterPlayerId: playerTeamAssignmentsTable.playerId,
      isActive: playerTeamAssignmentsTable.isActive,
      assignedAt: playerTeamAssignmentsTable.assignedAt,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        isNotNull(playerTeamAssignmentsTable.auctionPlayerId),
        tournamentIds ? inArray(playerTeamAssignmentsTable.tournamentId, tournamentIds) : undefined,
      ),
    );
  return assignmentsToSnapshots(rows);
}

function ledgerFromRow(row: {
  matchId: number;
  tournamentId: number;
  playerId: number;
  teamId: number;
  innings: number;
  battingJson: BattingStatsJson | null;
  bowlingJson: BowlingStatsJson | null;
  fieldingJson: { catches: number; runOuts: number; stumpings: number } | null;
}): CanonicalLedgerRow {
  return {
    matchId: row.matchId,
    tournamentId: row.tournamentId,
    playerId: row.playerId,
    teamId: row.teamId,
    innings: row.innings,
    batting: row.battingJson
      ? {
          playerId: row.playerId,
          runs: row.battingJson.runs,
          balls: row.battingJson.balls,
          fours: row.battingJson.fours,
          sixes: row.battingJson.sixes,
          strikeRate: row.battingJson.strikeRate,
          notOut: row.battingJson.notOut,
          dismissalType: row.battingJson.dismissalType as BattingCardRow["dismissalType"],
          dismissedByPlayerId: row.battingJson.dismissedByPlayerId ?? null,
          fielderId: row.battingJson.fielderId ?? null,
        }
      : null,
    bowling: row.bowlingJson
      ? {
          playerId: row.playerId,
          overs: row.bowlingJson.overs,
          legalBalls: row.bowlingJson.legalBalls,
          ballsPerOver: row.bowlingJson.ballsPerOver,
          maidens: row.bowlingJson.maidens,
          runs: row.bowlingJson.runs,
          wickets: row.bowlingJson.wickets,
          wides: row.bowlingJson.wides,
          noBalls: row.bowlingJson.noBalls,
          economy: row.bowlingJson.economy,
        }
      : null,
    fielding: row.fieldingJson ?? { catches: 0, runOuts: 0, stumpings: 0 },
  };
}

async function loadCompletedLedger(
  tx: StatsTx,
  tournamentIds?: number[],
): Promise<CanonicalLedgerRow[]> {
  if (tournamentIds && tournamentIds.length === 0) return [];
  const rows = await tx
    .select({
      matchId: scoringMatchPlayerStatsTable.matchId,
      tournamentId: scoringMatchPlayerStatsTable.tournamentId,
      playerId: scoringMatchPlayerStatsTable.playerId,
      teamId: scoringMatchPlayerStatsTable.teamId,
      innings: scoringMatchPlayerStatsTable.innings,
      battingJson: scoringMatchPlayerStatsTable.battingJson,
      bowlingJson: scoringMatchPlayerStatsTable.bowlingJson,
      fieldingJson: scoringMatchPlayerStatsTable.fieldingJson,
    })
    .from(scoringMatchPlayerStatsTable)
    .innerJoin(
      scoringMatchesTable,
      eq(scoringMatchesTable.id, scoringMatchPlayerStatsTable.matchId),
    )
    .where(
      and(
        eq(scoringMatchesTable.status, "completed"),
        tournamentIds
          ? inArray(scoringMatchPlayerStatsTable.tournamentId, tournamentIds)
          : undefined,
      ),
    );
  return rows.map(ledgerFromRow);
}

async function loadCompletedAppearances(
  tx: StatsTx,
  tournamentIds?: number[],
): Promise<MatchAppearance[]> {
  if (tournamentIds && tournamentIds.length === 0) return [];
  const squads = await tx
    .select({
      matchId: scoringMatchSquadsTable.matchId,
      teamId: scoringMatchSquadsTable.teamId,
      squadJson: scoringMatchSquadsTable.squadJson,
      tournamentId: scoringMatchesTable.tournamentId,
    })
    .from(scoringMatchSquadsTable)
    .innerJoin(scoringMatchesTable, eq(scoringMatchesTable.id, scoringMatchSquadsTable.matchId))
    .where(
      and(
        eq(scoringMatchesTable.status, "completed"),
        tournamentIds ? inArray(scoringMatchesTable.tournamentId, tournamentIds) : undefined,
      ),
    );

  const appearances: MatchAppearance[] = [];
  const seen = new Set<string>();
  for (const squad of squads) {
    for (const playerId of squad.squadJson.playingXi ?? []) {
      if (!Number.isInteger(playerId) || playerId <= 0) continue;
      const key = `${squad.matchId}:${playerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      appearances.push({
        tournamentId: squad.tournamentId,
        matchId: squad.matchId,
        playerId,
        teamId: squad.teamId,
      });
    }
  }
  return appearances;
}

function viewFromScoped(scoped: ScopedCricketAggregate[]): CanonicalCricketStatsView {
  const career = scoped.find((row) => row.tournamentId == null)?.stats ?? null;
  const tournaments = scoped
    .filter((row): row is ScopedCricketAggregate & { tournamentId: number } => row.tournamentId != null)
    .map((row) => ({ tournamentId: row.tournamentId, stats: row.stats }));
  return { career, tournaments, excluded: [] };
}

async function projectFromLedger(
  tx: StatsTx,
  tournamentIds?: number[],
): Promise<{
  scoped: ScopedCricketAggregate[];
  excluded: StatisticWritePlan["excluded"];
}> {
  const [assignments, ledger, appearances] = await Promise.all([
    loadAssignments(tx, tournamentIds),
    loadCompletedLedger(tx, tournamentIds),
    loadCompletedAppearances(tx, tournamentIds),
  ]);
  const identities = resolveOpaquePlayerIdentities(assignments);
  return buildCanonicalCricketAggregates({ ledger, appearances, identities });
}

async function persistPlan(tx: StatsTx, plan: StatisticWritePlan): Promise<void> {
  if (plan.deleteIds.length > 0) {
    await tx
      .delete(playerStatisticsTable)
      .where(
        and(
          eq(playerStatisticsTable.sport, CRICKET_SPORT),
          inArray(playerStatisticsTable.id, plan.deleteIds),
        ),
      );
  }

  for (const upsert of plan.upserts) {
    const existing = await tx
      .select({ id: playerStatisticsTable.id })
      .from(playerStatisticsTable)
      .where(
        and(
          eq(playerStatisticsTable.playerId, upsert.playerId),
          eq(playerStatisticsTable.sport, CRICKET_SPORT),
          upsert.tournamentId == null
            ? sql`${playerStatisticsTable.tournamentId} IS NULL`
            : eq(playerStatisticsTable.tournamentId, upsert.tournamentId),
        ),
      );
    const [keep, ...dupes] = existing;
    if (dupes.length > 0) {
      await tx
        .delete(playerStatisticsTable)
        .where(
          inArray(
            playerStatisticsTable.id,
            dupes.map((row) => row.id),
          ),
        );
    }
    if (keep) {
      await tx
        .update(playerStatisticsTable)
        .set({
          matchesPlayed: upsert.matchesPlayed,
          pointsScored: upsert.pointsScored,
          statsJson: upsert.stats,
          updatedAt: new Date(),
        })
        .where(eq(playerStatisticsTable.id, keep.id));
      continue;
    }
    await tx.insert(playerStatisticsTable).values({
      playerId: upsert.playerId,
      sport: CRICKET_SPORT,
      tournamentId: upsert.tournamentId,
      matchesPlayed: upsert.matchesPlayed,
      pointsScored: upsert.pointsScored,
      statsJson: upsert.stats,
    });
  }
}

async function replaceMatchLedger(
  tx: StatsTx,
  match: typeof scoringMatchesTable.$inferSelect,
  identities: Map<string, PlayerIdentityResolution>,
): Promise<{ previous: StatRow[]; nextPlayerIds: number[] }> {
  const previous = await tx
    .select()
    .from(scoringMatchPlayerStatsTable)
    .where(eq(scoringMatchPlayerStatsTable.matchId, match.id));

  await tx
    .delete(scoringMatchPlayerStatsTable)
    .where(eq(scoringMatchPlayerStatsTable.matchId, match.id));

  if (match.status !== "completed") {
    return { previous, nextPlayerIds: [] };
  }

  const events = await tx
    .select()
    .from(scoringEventsTable)
    .where(eq(scoringEventsTable.matchId, match.id))
    .orderBy(asc(scoringEventsTable.sequence));
  const rules = match.rulesJson as { ballsPerOver?: number } | null;
  const scorecard = buildCricketScorecardFromEvents(match.id, events.map(envelope), {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    ballsPerOver: rules?.ballsPerOver ?? 6,
  });
  const playerRows = scorecardToPlayerStats(scorecard);
  if (playerRows.length === 0) return { previous, nextPlayerIds: [] };

  await tx.insert(scoringMatchPlayerStatsTable).values(
    playerRows.map((row) => {
      const resolution = identities.get(identityKey(match.tournamentId, row.playerId));
      return {
        matchId: match.id,
        tournamentId: match.tournamentId,
        playerId: row.playerId,
        teamId: row.teamId,
        innings: row.innings,
        masterPlayerId: resolution?.status === "resolved" ? resolution.masterPlayerId : null,
        battingJson: row.batting
          ? {
              runs: row.batting.runs,
              balls: row.batting.balls,
              fours: row.batting.fours,
              sixes: row.batting.sixes,
              strikeRate: row.batting.strikeRate,
              notOut: row.batting.notOut,
              dismissalType: row.batting.dismissalType,
              dismissedByPlayerId: row.batting.dismissedByPlayerId,
              fielderId: row.batting.fielderId,
            }
          : null,
        bowlingJson: row.bowling
          ? {
              overs: row.bowling.overs,
              legalBalls: row.bowling.legalBalls,
              ballsPerOver: row.bowling.ballsPerOver,
              maidens: row.bowling.maidens,
              runs: row.bowling.runs,
              wickets: row.bowling.wickets,
              wides: row.bowling.wides,
              noBalls: row.bowling.noBalls,
              economy: row.bowling.economy,
            }
          : null,
        fieldingJson: row.fielding,
      };
    }),
  );

  return { previous, nextPlayerIds: playerRows.map((row) => row.playerId) };
}

function mastersForOpaqueIds(
  assignments: AssignmentSnapshot[],
  tournamentId: number,
  opaqueIds: number[],
): string[] {
  const wanted = new Set(opaqueIds);
  return [
    ...new Set(
      assignments
        .filter((row) => row.tournamentId === tournamentId && wanted.has(row.opaquePlayerId))
        .map((row) => row.masterPlayerId),
    ),
  ];
}

async function refreshMasters(tx: StatsTx, masterIds: string[]): Promise<void> {
  const uniqueMasters = [...new Set(masterIds.filter(Boolean))];
  if (uniqueMasters.length === 0) return;

  const links = await tx
    .select({ tournamentId: playerTeamAssignmentsTable.tournamentId })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        inArray(playerTeamAssignmentsTable.playerId, uniqueMasters),
      ),
    );
  const tournamentIds = [
    ...new Set(links.map((row) => row.tournamentId).filter((id): id is number => id != null)),
  ];

  const projected = await projectFromLedger(tx, tournamentIds);
  const existing = await tx
    .select({
      id: playerStatisticsTable.id,
      playerId: playerStatisticsTable.playerId,
      sport: playerStatisticsTable.sport,
      tournamentId: playerStatisticsTable.tournamentId,
      matchesPlayed: playerStatisticsTable.matchesPlayed,
    })
    .from(playerStatisticsTable)
    .where(
      and(
        eq(playerStatisticsTable.sport, CRICKET_SPORT),
        inArray(playerStatisticsTable.playerId, uniqueMasters),
      ),
    );

  const plan = planCricketStatisticWrites({
    existing,
    scoped: projected.scoped,
    affectedMasterIds: uniqueMasters,
  });
  const relevantTournaments = new Set(tournamentIds);
  plan.excluded = projected.excluded.filter((row) => relevantTournaments.has(row.tournamentId));
  if (plan.excluded.length > 0) {
    logger.warn(
      { excludedCount: plan.excluded.length, sample: plan.excluded.slice(0, 20) },
      "Cricket statistics left unattributed because player identity was missing or ambiguous",
    );
  }
  await persistPlan(tx, plan);
}

async function syncWithin(tx: StatsTx, matchId: number): Promise<void> {
  const [match] = await tx
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1)
    .for("update");
  if (!match || match.sportSlug !== CRICKET_SPORT) return;

  const assignments = await loadAssignments(tx, [match.tournamentId]);
  const identities = resolveOpaquePlayerIdentities(assignments);
  const { previous, nextPlayerIds } = await replaceMatchLedger(tx, match, identities);

  const opaqueIds = [
    ...new Set([...previous.map((row) => row.playerId), ...nextPlayerIds]),
  ];
  const affected = new Set<string>();
  for (const row of previous) {
    if (row.masterPlayerId) affected.add(row.masterPlayerId);
  }
  for (const masterId of mastersForOpaqueIds(assignments, match.tournamentId, opaqueIds)) {
    affected.add(masterId);
  }
  await refreshMasters(tx, [...affected]);
}

/**
 * Replace one match's ledger rows and the canonical totals of every player it
 * affects. Caller must already be inside a transaction. The advisory lock is
 * re-entrant, so this is safe when the caller also locks.
 */
export async function applyCricketMatchStatistics(tx: StatsTx, matchId: number): Promise<void> {
  await lockCricketStatistics(tx);
  await syncWithin(tx, matchId);
}

/** Replace one match's ledger rows and the canonical totals of every player it affects. */
export async function syncCricketMatchStatistics(matchId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await applyCricketMatchStatistics(tx, matchId);
  });
}

/**
 * Tournament totals for scoring player ids, from completed scorecards plus
 * playing-XI appearances. This is the tournament-scoped view. Career totals
 * fold every resolved registration of the same canonical player into one row.
 */
export async function aggregateCompletedTournamentPlayers(
  tournamentId: number,
  filter?: { playerId?: number; teamId?: number },
): Promise<{
  aggregates: Map<number, TournamentPlayerAggregate>;
  matchIdsByPlayer: Map<number, number[]>;
}> {
  return db.transaction(async (tx) => {
    const ledger = await loadCompletedLedger(tx, [tournamentId]);
    const appearances = await loadCompletedAppearances(tx, [tournamentId]);
    const rows = ledger.filter((row) => {
      if (filter?.playerId != null && row.playerId !== filter.playerId) return false;
      if (filter?.teamId != null && row.teamId !== filter.teamId) return false;
      return true;
    });
    const visibleAppearances = appearances.filter((row) => {
      if (filter?.playerId != null && row.playerId !== filter.playerId) return false;
      if (filter?.teamId != null && row.teamId !== filter.teamId) return false;
      return true;
    });
    const matchIdsByPlayer = new Map<number, Set<number>>();
    function note(playerId: number, matchId: number) {
      const ids = matchIdsByPlayer.get(playerId) ?? new Set<number>();
      ids.add(matchId);
      matchIdsByPlayer.set(playerId, ids);
    }
    for (const row of rows) note(row.playerId, row.matchId);
    for (const appearance of visibleAppearances) note(appearance.playerId, appearance.matchId);
    return {
      aggregates: aggregateTournamentPlayerStats(rows, { appearances: visibleAppearances }),
      matchIdsByPlayer: new Map(
        [...matchIdsByPlayer].map(([playerId, ids]) => [playerId, [...ids]]),
      ),
    };
  });
}

/**
 * Rewrite every cricket tournament and career cache row from completed scorecards.
 * Holds the same lock as a single-match sync. Does not delete other sports.
 */
export async function rebuildCricketPlayerStatistics(): Promise<void> {
  await db.transaction(async (tx) => {
    await lockCricketStatistics(tx);
    const projected = await projectFromLedger(tx);
    const existing = await tx
      .select({
        id: playerStatisticsTable.id,
        playerId: playerStatisticsTable.playerId,
        sport: playerStatisticsTable.sport,
        tournamentId: playerStatisticsTable.tournamentId,
        matchesPlayed: playerStatisticsTable.matchesPlayed,
      })
      .from(playerStatisticsTable)
      .where(eq(playerStatisticsTable.sport, CRICKET_SPORT));
    const plan = planCricketStatisticWrites({
      existing,
      scoped: projected.scoped,
    });
    plan.excluded = projected.excluded;
    if (plan.excluded.length > 0) {
      logger.warn(
        { excludedCount: plan.excluded.length, sample: plan.excluded.slice(0, 20) },
        "Cricket statistics left unattributed during rebuild",
      );
    }
    await persistPlan(tx, plan);
  });
}

/** Live career and tournament totals for one canonical player, read from the ledger. */
export async function loadCanonicalCricketStats(
  masterPlayerId: string,
): Promise<CanonicalCricketStatsView> {
  return db.transaction(async (tx) => {
    const links = await tx
      .select({ tournamentId: playerTeamAssignmentsTable.tournamentId })
      .from(playerTeamAssignmentsTable)
      .where(
        and(
          eq(playerTeamAssignmentsTable.playerId, masterPlayerId),
          eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        ),
      );
    const tournamentIds = [
      ...new Set(links.map((row) => row.tournamentId).filter((id): id is number => id != null)),
    ];
    const projected = await projectFromLedger(tx, tournamentIds);
    const mine = projected.scoped.filter((row) => row.masterPlayerId === masterPlayerId);
    const view = viewFromScoped(mine);
    view.excluded = projected.excluded.filter((row) => tournamentIds.includes(row.tournamentId));
    return view;
  });
}

export async function resolveCricketPlayerIdentity(
  tournamentId: number,
  opaquePlayerId: number,
): Promise<PlayerIdentityResolution> {
  return db.transaction(async (tx) => {
    const assignments = await loadAssignments(tx, [tournamentId]);
    return (
      resolveOpaquePlayerIdentities(assignments).get(identityKey(tournamentId, opaquePlayerId)) ?? {
        status: "unresolved",
      }
    );
  });
}
