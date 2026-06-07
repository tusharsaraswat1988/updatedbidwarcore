import type { CricketMatchSummary } from "./summary";

export type StandingsMatchInput = {
  matchId: number;
  status: "completed" | "abandoned";
  homeTeamId: number;
  awayTeamId: number;
  summary: CricketMatchSummary | null;
  /** From match.completed event when summary lacks tie flag. */
  isTie?: boolean;
};

export type TeamStandingComputed = {
  teamId: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
};

/** Convert overs string e.g. "19.3" → 19.5 (decimal balls). */
export function oversStringToDecimal(overs: string): number {
  const trimmed = overs.trim();
  if (!trimmed) return 0;
  const [wholePart, ballPart] = trimmed.split(".");
  const oversWhole = Number.parseInt(wholePart ?? "0", 10);
  const balls = Number.parseInt(ballPart ?? "0", 10);
  if (Number.isNaN(oversWhole) || Number.isNaN(balls)) return 0;
  return oversWhole + balls / 6;
}

function emptyStanding(teamId: number): TeamStandingComputed {
  return {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
  };
}

function ensureTeam(map: Map<number, TeamStandingComputed>, teamId: number) {
  if (!map.has(teamId)) {
    map.set(teamId, emptyStanding(teamId));
  }
  return map.get(teamId)!;
}

function applyNrrFromSummary(
  map: Map<number, TeamStandingComputed>,
  summary: CricketMatchSummary,
) {
  for (const inn of summary.innings) {
    const batting = ensureTeam(map, inn.battingTeamId);
    const bowling = ensureTeam(map, inn.bowlingTeamId);
    const overs = oversStringToDecimal(inn.overs);

    batting.runsScored += inn.runs;
    batting.oversFaced += overs;
    bowling.runsConceded += inn.runs;
    bowling.oversBowled += overs;
  }
}

function finalizeNrr(row: TeamStandingComputed): number {
  if (row.oversFaced === 0 && row.oversBowled === 0) return 0;
  const scoredRate = row.oversFaced > 0 ? row.runsScored / row.oversFaced : 0;
  const concededRate = row.oversBowled > 0 ? row.runsConceded / row.oversBowled : 0;
  return scoredRate - concededRate;
}

/**
 * Build points table from completed/abandoned matches.
 * Points: win 2, tie/no-result 1 each, loss 0.
 */
export function buildStandingsFromMatches(
  teamIds: number[],
  matches: StandingsMatchInput[],
): TeamStandingComputed[] {
  const map = new Map<number, TeamStandingComputed>();
  for (const id of teamIds) {
    map.set(id, emptyStanding(id));
  }

  for (const match of matches) {
    const home = ensureTeam(map, match.homeTeamId);
    const away = ensureTeam(map, match.awayTeamId);

    if (match.status === "abandoned") {
      home.played += 1;
      away.played += 1;
      home.noResult += 1;
      away.noResult += 1;
      home.points += 1;
      away.points += 1;
      if (match.summary) applyNrrFromSummary(map, match.summary);
      continue;
    }

    home.played += 1;
    away.played += 1;

    const winnerId = match.summary?.winnerTeamId ?? null;
    const isTie = match.isTie ?? (winnerId === null);

    if (isTie) {
      home.tied += 1;
      away.tied += 1;
      home.points += 1;
      away.points += 1;
    } else if (winnerId === match.homeTeamId) {
      home.won += 1;
      away.lost += 1;
      home.points += 2;
    } else if (winnerId === match.awayTeamId) {
      away.won += 1;
      home.lost += 1;
      away.points += 2;
    }

    if (match.summary) applyNrrFromSummary(map, match.summary);
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    netRunRate: finalizeNrr(row),
  }));

  return rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate;
    return a.teamId - b.teamId;
  });
}
