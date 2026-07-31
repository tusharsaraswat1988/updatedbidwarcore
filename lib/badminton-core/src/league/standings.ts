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
};

function emptyStanding(registrationId: number): PairStandingComputed {
  return { registrationId, played: 0, won: 0, lost: 0, marginPoints: 0 };
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

const TERMINAL_STATUSES = new Set([
  "completed",
  "walkover",
  "retired",
  "disqualified",
  "abandoned",
]);

/**
 * Build pair standings from completed league matches.
 * Points = sum of rally margins from won games only (Formula A).
 */
export function buildPairStandingsFromMatches(
  registrationIds: number[],
  matches: PairStandingsMatchInput[],
): PairStandingComputed[] {
  const map = new Map<number, PairStandingComputed>();
  for (const id of registrationIds) {
    map.set(id, emptyStanding(id));
  }

  for (const match of matches) {
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
  }

  return [...map.values()].sort((a, b) => {
    if (b.marginPoints !== a.marginPoints) return b.marginPoints - a.marginPoints;
    if (b.won !== a.won) return b.won - a.won;
    return a.registrationId - b.registrationId;
  });
}
