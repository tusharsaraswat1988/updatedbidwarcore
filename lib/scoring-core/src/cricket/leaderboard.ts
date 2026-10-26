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
  /** Batting innings, one per scorecard batting row. */
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  /** Out for a duck. Retired hurt is not out and is not a duck. */
  ducks: number;
  /** Null when the player has no batting innings. */
  highestScore: number | null;
  highestScoreNotOut: boolean;
  wickets: number;
  /** True overs: sum of legal balls / balls-per-over. Not cricket notation. */
  oversBowled: number;
  /** Legal deliveries bowled. Canonical bowling volume. */
  legalBalls: number;
  runsConceded: number;
  maidens: number;
  /** Wide deliveries, not wide runs. */
  wides: number;
  /** No-ball deliveries, not no-ball runs. */
  noBalls: number;
  /** Best innings by wickets, then fewer runs. Null when the player did not bowl. */
  bestBowlingWickets: number | null;
  bestBowlingRuns: number | null;
  catches: number;
  runOuts: number;
  stumpings: number;
  /**
   * `canonical` when every bowling spell stored an integer legal-ball count.
   * `assumed-six-ball` when a historical `overs.balls` string was parsed as six-ball.
   * `incomplete` when a spell's notation could not be parsed for its format.
   */
  oversNotation: "canonical" | "assumed-six-ball" | "incomplete";
};

export type CricketCareerStats = {
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  highestScore: number | null;
  highestScoreNotOut: boolean;
  battingAverage: number | null;
  strikeRate: number | null;
  wickets: number;
  oversBowled: number;
  legalBalls: number;
  runsConceded: number;
  maidens: number;
  wides: number;
  noBalls: number;
  bowlingAverage: number | null;
  economy: number | null;
  bowlingStrikeRate: number | null;
  bestBowlingWickets: number | null;
  bestBowlingRuns: number | null;
  catches: number;
  runOuts: number;
  stumpings: number;
  oversNotation: "canonical" | "assumed-six-ball" | "incomplete";
};

export type LeaderboardRow = {
  playerId: number;
  teamId: number;
  value: number;
  rank: number;
};

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Parse cricket `overs.balls` notation into a legal-ball count.
 * Returns null when the ball remainder is outside the format (for example
 * `1.6` in a six-ball over). That figure is not treated as verified.
 */
export function parseOversNotation(overs: string, ballsPerOver = 6): number | null {
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  const text = overs.trim();
  const wholeOnly = /^(\d+)$/.exec(text);
  if (wholeOnly) return Number(wholeOnly[1]) * bpo;
  const match = /^(\d+)\.(\d+)$/.exec(text);
  if (!match) return null;
  const whole = Number(match[1]);
  const balls = Number(match[2]);
  if (!Number.isInteger(whole) || !Number.isInteger(balls) || balls >= bpo) return null;
  return whole * bpo + balls;
}

export function resolveBowlingSpell(bowling: {
  overs: string;
  legalBalls?: number;
  ballsPerOver?: number;
}): {
  legalBalls: number;
  ballsPerOver: number;
  oversDecimal: number;
  notationVerified: boolean;
} | null {
  const formatExplicit = typeof bowling.ballsPerOver === "number" && bowling.ballsPerOver > 0;
  const ballsPerOver = formatExplicit ? bowling.ballsPerOver! : 6;
  if (
    typeof bowling.legalBalls === "number" &&
    Number.isInteger(bowling.legalBalls) &&
    bowling.legalBalls >= 0
  ) {
    return {
      legalBalls: bowling.legalBalls,
      ballsPerOver,
      oversDecimal: bowling.legalBalls / ballsPerOver,
      notationVerified: true,
    };
  }
  const parsed = parseOversNotation(bowling.overs, ballsPerOver);
  if (parsed == null) return null;
  return {
    legalBalls: parsed,
    ballsPerOver,
    oversDecimal: parsed / ballsPerOver,
    notationVerified: formatExplicit,
  };
}

function emptyAggregate(playerId: number, teamId: number): TournamentPlayerAggregate {
  return {
    playerId,
    teamId,
    matches: 0,
    innings: 0,
    notOuts: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
    highestScore: null,
    highestScoreNotOut: false,
    wickets: 0,
    oversBowled: 0,
    legalBalls: 0,
    runsConceded: 0,
    maidens: 0,
    wides: 0,
    noBalls: 0,
    bestBowlingWickets: null,
    bestBowlingRuns: null,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    oversNotation: "canonical",
  };
}

function isBetterBowling(
  wickets: number,
  runs: number,
  bestWickets: number | null,
  bestRuns: number | null,
): boolean {
  if (bestWickets == null || bestRuns == null) return true;
  if (wickets !== bestWickets) return wickets > bestWickets;
  return runs < bestRuns;
}

export function derivedCricketStats(agg: TournamentPlayerAggregate): CricketCareerStats {
  const dismissals = agg.innings - agg.notOuts;
  return {
    matches: agg.matches,
    innings: agg.innings,
    notOuts: agg.notOuts,
    runs: agg.runs,
    balls: agg.balls,
    fours: agg.fours,
    sixes: agg.sixes,
    fifties: agg.fifties,
    hundreds: agg.hundreds,
    ducks: agg.ducks,
    highestScore: agg.highestScore,
    highestScoreNotOut: agg.highestScoreNotOut,
    battingAverage: dismissals > 0 ? roundTo(agg.runs / dismissals, 2) : null,
    strikeRate: agg.balls > 0 ? roundTo((agg.runs / agg.balls) * 100, 2) : null,
    wickets: agg.wickets,
    oversBowled: agg.oversBowled,
    legalBalls: agg.legalBalls,
    runsConceded: agg.runsConceded,
    maidens: agg.maidens,
    wides: agg.wides,
    noBalls: agg.noBalls,
    bowlingAverage: agg.wickets > 0 ? roundTo(agg.runsConceded / agg.wickets, 2) : null,
    economy: agg.oversBowled > 0 ? roundTo(agg.runsConceded / agg.oversBowled, 2) : null,
    bowlingStrikeRate:
      agg.wickets > 0 && agg.legalBalls > 0 ? roundTo(agg.legalBalls / agg.wickets, 2) : null,
    bestBowlingWickets: agg.bestBowlingWickets,
    bestBowlingRuns: agg.bestBowlingRuns,
    catches: agg.catches,
    runOuts: agg.runOuts,
    stumpings: agg.stumpings,
    oversNotation: agg.oversNotation,
  };
}

export type PlayerMatchAppearance = {
  matchId: number;
  playerId: number;
  teamId: number;
};

/**
 * Fold per-innings scorecard rows into one total per player.
 * `appearances` counts a match for a playing-XI member who did not bat, bowl,
 * or receive a fielding credit. A player already present on the scorecard is
 * not counted twice.
 */
export function aggregateTournamentPlayerStats(
  rows: PlayerMatchStatsInput[],
  options?: { appearances?: PlayerMatchAppearance[] },
): Map<number, TournamentPlayerAggregate> {
  const map = new Map<number, TournamentPlayerAggregate>();
  const matchesSeen = new Map<number, Set<number>>();
  const ballsByFormat = new Map<number, Map<number, number>>();

  function ensure(playerId: number, teamId: number): TournamentPlayerAggregate {
    let agg = map.get(playerId);
    if (!agg) {
      agg = emptyAggregate(playerId, teamId);
      map.set(playerId, agg);
      matchesSeen.set(playerId, new Set());
      ballsByFormat.set(playerId, new Map());
    }
    return agg;
  }

  function markMatch(playerId: number, matchId: number): void {
    const seen = matchesSeen.get(playerId)!;
    if (seen.has(matchId)) return;
    seen.add(matchId);
    map.get(playerId)!.matches += 1;
  }

  for (const row of rows) {
    const agg = ensure(row.playerId, row.teamId);
    markMatch(row.playerId, row.matchId);

    if (row.batting) {
      agg.innings += 1;
      agg.runs += row.batting.runs;
      agg.balls += row.batting.balls;
      agg.fours += row.batting.fours;
      agg.sixes += row.batting.sixes;
      if (row.batting.notOut) agg.notOuts += 1;
      else if (row.batting.runs === 0) agg.ducks += 1;
      if (row.batting.runs >= 100) agg.hundreds += 1;
      else if (row.batting.runs >= 50) agg.fifties += 1;
      if (
        agg.highestScore == null ||
        row.batting.runs > agg.highestScore ||
        (row.batting.runs === agg.highestScore && row.batting.notOut && !agg.highestScoreNotOut)
      ) {
        agg.highestScore = row.batting.runs;
        agg.highestScoreNotOut = row.batting.notOut;
      }
    }

    if (row.bowling) {
      agg.wickets += row.bowling.wickets;
      agg.runsConceded += row.bowling.runs;
      agg.maidens += row.bowling.maidens;
      agg.wides += row.bowling.wides;
      agg.noBalls += row.bowling.noBalls;
      const spell = resolveBowlingSpell(row.bowling);
      if (!spell) {
        agg.oversNotation = "incomplete";
      } else {
        if (!spell.notationVerified && agg.oversNotation === "canonical") {
          agg.oversNotation = "assumed-six-ball";
        }
        const formats = ballsByFormat.get(row.playerId)!;
        formats.set(spell.ballsPerOver, (formats.get(spell.ballsPerOver) ?? 0) + spell.legalBalls);
      }
      if (
        isBetterBowling(
          row.bowling.wickets,
          row.bowling.runs,
          agg.bestBowlingWickets,
          agg.bestBowlingRuns,
        )
      ) {
        agg.bestBowlingWickets = row.bowling.wickets;
        agg.bestBowlingRuns = row.bowling.runs;
      }
    }

    agg.catches += row.fielding.catches;
    agg.runOuts += row.fielding.runOuts;
    agg.stumpings += row.fielding.stumpings;
  }

  for (const appearance of options?.appearances ?? []) {
    ensure(appearance.playerId, appearance.teamId);
    markMatch(appearance.playerId, appearance.matchId);
  }

  for (const [playerId, formats] of ballsByFormat) {
    const agg = map.get(playerId);
    if (!agg) continue;
    let legalBalls = 0;
    let oversBowled = 0;
    for (const [ballsPerOver, balls] of formats) {
      legalBalls += balls;
      oversBowled += balls / ballsPerOver;
    }
    agg.legalBalls = legalBalls;
    agg.oversBowled = oversBowled;
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
      let fielderRow = out.find(
        (r) => r.playerId === bat.fielderId && r.innings === inn.innings,
      );
      if (!fielderRow) {
        fielderRow = {
          matchId: scorecard.matchId,
          playerId: bat.fielderId,
          teamId: inn.bowlingTeamId,
          innings: inn.innings,
          batting: null,
          bowling: null,
          fielding: { catches: 0, runOuts: 0, stumpings: 0 },
        };
        out.push(fielderRow);
      }
      if (bat.dismissalType === "caught") fielderRow.fielding.catches += 1;
      if (bat.dismissalType === "run_out") fielderRow.fielding.runOuts += 1;
      if (bat.dismissalType === "stumped") fielderRow.fielding.stumpings += 1;
    }
  }

  return out;
}
