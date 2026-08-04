import { hasCompletedGames } from "../assigned-margin";
import type { BadmintonGameState, BadmintonSide } from "../types";

export type PairStandingsMatchInput = {
  matchId: number;
  registrationAId: number;
  registrationBId: number;
  winnerRegistrationId: number | null;
  /** Which side won — used when winnerRegistrationId is not yet set. */
  winnerSide?: BadmintonSide | null;
  games: BadmintonGameState[];
  status: string;
  /** Used when no completed games (walkover / early terminal). */
  assignedMarginPoints?: number | null;
};

export type PairStandingComputed = {
  registrationId: number;
  played: number;
  won: number;
  lost: number;
  marginPoints: number;
  pointsFor: number;
  pointsAgainst: number;
  matchesRemaining: number;
  winPercentage: number;
};

function emptyStanding(registrationId: number): PairStandingComputed {
  return {
    registrationId,
    played: 0,
    won: 0,
    lost: 0,
    marginPoints: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    matchesRemaining: 0,
    winPercentage: 0,
  };
}

function ensurePair(
  map: Map<number, PairStandingComputed>,
  registrationId: number,
): PairStandingComputed {
  if (!map.has(registrationId)) {
    map.set(registrationId, emptyStanding(registrationId));
  }
  return map.get(registrationId)!;
}

/** Margin points from games won by `side` only (rally point difference per won game). */
export function marginPointsFromWonGames(
  games: BadmintonGameState[],
  side: BadmintonSide,
): number {
  let total = 0;
  for (const game of games) {
    if (game.phase !== "completed" || game.winner !== side) continue;
    const won = side === "left" ? game.leftScore : game.rightScore;
    const lost = side === "left" ? game.rightScore : game.leftScore;
    total += won - lost;
  }
  return total;
}

/**
 * Effective standings margin for a match winner.
 * Completed won games take precedence; otherwise director-assigned margin.
 */
export function effectiveWinnerMarginPoints(
  games: BadmintonGameState[],
  winnerSide: BadmintonSide,
  assignedMarginPoints?: number | null,
): number {
  if (hasCompletedGames(games)) {
    return marginPointsFromWonGames(games, winnerSide);
  }
  if (
    assignedMarginPoints != null &&
    Number.isInteger(assignedMarginPoints) &&
    assignedMarginPoints > 0
  ) {
    return assignedMarginPoints;
  }
  return 0;
}

/** Rally points scored / conceded across completed games for one side. */
export function rallyPointsForSide(
  games: BadmintonGameState[],
  side: BadmintonSide,
): { pointsFor: number; pointsAgainst: number } {
  let pointsFor = 0;
  let pointsAgainst = 0;
  for (const game of games) {
    if (game.phase !== "completed") continue;
    const scored = side === "left" ? game.leftScore : game.rightScore;
    const conceded = side === "left" ? game.rightScore : game.leftScore;
    pointsFor += scored;
    pointsAgainst += conceded;
  }
  return { pointsFor, pointsAgainst };
}

/**
 * Win percentage: Wins / Played × 100.
 * Played = 0 → 0. One decimal place. Clamped to [0, 100].
 */
export function computeWinPercentage(won: number, played: number): number {
  if (played <= 0) return 0;
  const raw = (won / played) * 100;
  const rounded = Math.round(raw * 10) / 10;
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "walkover",
  "retired",
  "disqualified",
  "abandoned",
]);

/** Statuses that do not count toward scheduled match totals. */
const NON_SCHEDULED_STATUSES = new Set(["cancelled"]);

/** VNBL ranking: wins first, then point-difference (margin), then stable id. */
export function comparePairStandings(
  a: Pick<PairStandingComputed, "won" | "marginPoints" | "registrationId">,
  b: Pick<PairStandingComputed, "won" | "marginPoints" | "registrationId">,
): number {
  if (b.won !== a.won) return b.won - a.won;
  if (b.marginPoints !== a.marginPoints) return b.marginPoints - a.marginPoints;
  return a.registrationId - b.registrationId;
}

/**
 * Build pair standings from league matches in a single pass.
 *
 * - Terminal matches update W/L/margin/PF/PA/played
 * - Non-cancelled matches with both sides count toward scheduled
 * - matchesRemaining = max(0, scheduled − played)
 * - winPercentage derived from won/played
 *
 * Margin = sum of rally margins from won games only (or assigned WO margin).
 * Rank = wins DESC, then margin DESC (unchanged).
 */
export function buildPairStandingsFromMatches(
  registrationIds: number[],
  matches: PairStandingsMatchInput[],
): PairStandingComputed[] {
  const map = new Map<number, PairStandingComputed>();
  for (const id of registrationIds) {
    map.set(id, emptyStanding(id));
  }

  const scheduled = new Map<number, number>();
  for (const id of registrationIds) {
    scheduled.set(id, 0);
  }

  for (const match of matches) {
    const aId = match.registrationAId;
    const bId = match.registrationBId;
    if (!aId || !bId) continue;

    if (!NON_SCHEDULED_STATUSES.has(match.status)) {
      scheduled.set(aId, (scheduled.get(aId) ?? 0) + 1);
      scheduled.set(bId, (scheduled.get(bId) ?? 0) + 1);
      // Ensure rows exist for any registration seen in fixtures.
      ensurePair(map, aId);
      ensurePair(map, bId);
    }

    if (!TERMINAL_STATUSES.has(match.status)) continue;

    const winnerId =
      match.winnerRegistrationId ??
      (match.winnerSide === "left"
        ? match.registrationAId
        : match.winnerSide === "right"
          ? match.registrationBId
          : null);

    if (!winnerId) continue;

    const loserId =
      winnerId === match.registrationAId ? match.registrationBId : match.registrationAId;

    const winnerSide: BadmintonSide =
      winnerId === match.registrationAId ? "left" : "right";
    const loserSide: BadmintonSide = winnerSide === "left" ? "right" : "left";

    const winner = ensurePair(map, winnerId);
    winner.played += 1;
    winner.won += 1;
    winner.marginPoints += effectiveWinnerMarginPoints(
      match.games,
      winnerSide,
      match.assignedMarginPoints,
    );

    if (loserId) {
      const loser = ensurePair(map, loserId);
      loser.played += 1;
      loser.lost += 1;
    }

    // PF/PA: completed games when present; else assigned WO margin for winner/loser.
    if (hasCompletedGames(match.games)) {
      const winnerPts = rallyPointsForSide(match.games, winnerSide);
      winner.pointsFor += winnerPts.pointsFor;
      winner.pointsAgainst += winnerPts.pointsAgainst;
      if (loserId) {
        const loserPts = rallyPointsForSide(match.games, loserSide);
        const loser = ensurePair(map, loserId);
        loser.pointsFor += loserPts.pointsFor;
        loser.pointsAgainst += loserPts.pointsAgainst;
      }
    } else {
      const assigned =
        match.assignedMarginPoints != null &&
        Number.isInteger(match.assignedMarginPoints) &&
        match.assignedMarginPoints > 0
          ? match.assignedMarginPoints
          : 0;
      if (assigned > 0) {
        winner.pointsFor += assigned;
        if (loserId) {
          ensurePair(map, loserId).pointsAgainst += assigned;
        }
      }
    }
  }

  for (const row of map.values()) {
    const sched = scheduled.get(row.registrationId) ?? 0;
    row.matchesRemaining = Math.max(0, sched - row.played);
    row.winPercentage = computeWinPercentage(row.won, row.played);
    // Guard invariants
    if (row.pointsFor < 0) row.pointsFor = 0;
    if (row.pointsAgainst < 0) row.pointsAgainst = 0;
  }

  return [...map.values()].sort(comparePairStandings);
}
