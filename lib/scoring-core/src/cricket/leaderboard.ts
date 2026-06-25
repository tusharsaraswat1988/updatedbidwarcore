import type { BattingCardRow, BowlingCardRow, CricketFullScorecard } from "./scorecard";

export type PlayerMatchStatsInput = {
  matchId: number;
  playerId: number;
  teamId: number;
  innings: number;
  batting: BattingCardRow | null;
  bowling: BowlingCardRow | null;
  fielding: { catches: number; runOuts: number; stumpings: number };
};

export type TournamentPlayerAggregate = {
  playerId: number;
  teamId: number;
  matches: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  wickets: number;
  oversBowled: number;
  runsConceded: number;
  catches: number;
  runOuts: number;
  stumpings: number;
};

export type LeaderboardRow = {
  playerId: number;
  teamId: number;
  value: number;
  rank: number;
};

function oversToDecimal(overs: string): number {
  const parts = overs.split(".");
  const w = parseInt(parts[0] ?? "0", 10);
  const b = parseInt(parts[1] ?? "0", 10);
  return w + b / 6;
}

export function aggregateTournamentPlayerStats(
  rows: PlayerMatchStatsInput[],
): Map<number, TournamentPlayerAggregate> {
  const map = new Map<number, TournamentPlayerAggregate>();
  const matchesSeen = new Map<number, Set<number>>();

  for (const row of rows) {
    let agg = map.get(row.playerId);
    if (!agg) {
      agg = {
        playerId: row.playerId,
        teamId: row.teamId,
        matches: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        fifties: 0,
        hundreds: 0,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
      };
      map.set(row.playerId, agg);
      matchesSeen.set(row.playerId, new Set());
    }

    const seen = matchesSeen.get(row.playerId)!;
    if (!seen.has(row.matchId)) {
      seen.add(row.matchId);
      agg.matches += 1;
    }

    if (row.batting) {
      agg.runs += row.batting.runs;
      agg.balls += row.batting.balls;
      agg.fours += row.batting.fours;
      agg.sixes += row.batting.sixes;
      if (row.batting.runs >= 100) agg.hundreds += 1;
      else if (row.batting.runs >= 50) agg.fifties += 1;
    }

    if (row.bowling) {
      agg.wickets += row.bowling.wickets;
      agg.oversBowled += oversToDecimal(row.bowling.overs);
      agg.runsConceded += row.bowling.runs;
    }

    agg.catches += row.fielding.catches;
    agg.runOuts += row.fielding.runOuts;
    agg.stumpings += row.fielding.stumpings;
  }

  return map;
}

export type LeaderboardCategory =
  | "runs"
  | "wickets"
  | "sixes"
  | "fours"
  | "strike_rate"
  | "economy"
  | "catches"
  | "stumpings";

export function buildLeaderboard(
  aggregates: Map<number, TournamentPlayerAggregate>,
  category: LeaderboardCategory,
  limit = 20,
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = [];

  for (const agg of aggregates.values()) {
    let value = 0;
    switch (category) {
      case "runs":
        value = agg.runs;
        break;
      case "wickets":
        value = agg.wickets;
        break;
      case "sixes":
        value = agg.sixes;
        break;
      case "fours":
        value = agg.fours;
        break;
      case "strike_rate":
        value = agg.balls >= 20 ? Math.round((agg.runs / agg.balls) * 10000) / 100 : 0;
        break;
      case "economy":
        value =
          agg.oversBowled >= 2
            ? Math.round((agg.runsConceded / agg.oversBowled) * 100) / 100
            : 999;
        break;
      case "catches":
        value = agg.catches;
        break;
      case "stumpings":
        value = agg.stumpings;
        break;
    }
    if (value <= 0 || (category === "economy" && value >= 999)) continue;
    rows.push({ playerId: agg.playerId, teamId: agg.teamId, value, rank: 0 });
  }

  const desc = category !== "economy";
  rows.sort((a, b) => (desc ? b.value - a.value : a.value - b.value));

  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function scorecardToPlayerStats(
  scorecard: CricketFullScorecard,
): PlayerMatchStatsInput[] {
  const out: PlayerMatchStatsInput[] = [];

  for (const inn of scorecard.innings) {
    for (const bat of inn.batting) {
      out.push({
        matchId: scorecard.matchId,
        playerId: bat.playerId,
        teamId: inn.battingTeamId,
        innings: inn.innings,
        batting: bat,
        bowling: null,
        fielding: { catches: 0, runOuts: 0, stumpings: 0 },
      });
    }

    for (const bowl of inn.bowling) {
      const existing = out.find(
        (r) => r.playerId === bowl.playerId && r.innings === inn.innings,
      );
      if (existing) {
        existing.bowling = bowl;
      } else {
        out.push({
          matchId: scorecard.matchId,
          playerId: bowl.playerId,
          teamId: inn.bowlingTeamId,
          innings: inn.innings,
          batting: null,
          bowling: bowl,
          fielding: { catches: 0, runOuts: 0, stumpings: 0 },
        });
      }
    }

    for (const bat of inn.batting) {
      if (!bat.fielderId) continue;
      const fielderRow = out.find(
        (r) => r.playerId === bat.fielderId && r.innings === inn.innings,
      );
      if (!fielderRow) continue;
      if (bat.dismissalType === "caught") fielderRow.fielding.catches += 1;
      if (bat.dismissalType === "run_out") fielderRow.fielding.runOuts += 1;
      if (bat.dismissalType === "stumped") fielderRow.fielding.stumpings += 1;
    }
  }

  return out;
}
