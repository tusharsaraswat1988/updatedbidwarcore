import type { CricketMatchSummary } from "./summary";

export type StandingsMatchInput = {
  matchId: number;
  status: "completed" | "abandoned" | "no_result" | "walkover" | string;
  homeTeamId: number;
  awayTeamId: number;
  summary: CricketMatchSummary | null;
  /** From match.completed event when summary lacks tie flag. */
  isTie?: boolean;
};

/**
 * Points awarded for each league result, plus the denominator for points percentage.
 * Defaults match the current cricket system (win 2, tie/no-result 1, loss 0).
 */
export type CricketPointsRules = {
  winPoints: number;
  tiePoints: number;
  noResultPoints: number;
  lossPoints: number;
  maxPointsPerMatch: number;
};

export const DEFAULT_CRICKET_POINTS_RULES: CricketPointsRules = {
  winPoints: 2,
  tiePoints: 1,
  noResultPoints: 1,
  lossPoints: 0,
  maxPointsPerMatch: 2,
};

export type TeamStandingComputed = {
  teamId: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  /** (points / (played × maxPointsPerMatch)) × 100. 0 when played is 0. Full precision. */
  pointsPercentage: number;
  netRunRate: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
};

/** Minimal row shape used by the shared cricket ranking comparator. */
export type CricketStandingRankInput = {
  teamId: number;
  played: number;
  points: number;
  netRunRate: number;
  pointsPercentage?: number;
};

/** League result used only for head-to-head. Callers must pass league matches, not knockouts. */
export type HeadToHeadMatch = {
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  winnerTeamId: number | null;
  /**
   * Explicit tie from the match-completed event.
   * Undefined means "not recorded": a missing winner is then a tie.
   * `false` means the match is not a tie even when the winner is missing.
   */
  isTie?: boolean;
};

/** Persisted standings row. `extras` holds full-precision run and over totals when present. */
export type PersistedCricketStanding = {
  teamId: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number | string | null;
  extras?: unknown;
};

type HeadToHeadPair = {
  meetings: number;
  points: Map<number, number>;
  wins: Map<number, number>;
};

export type HeadToHeadIndex = {
  pairs: Map<string, HeadToHeadPair>;
};

const STANDINGS_ELIGIBLE_STATUSES = new Set(["completed", "abandoned", "no_result", "walkover"]);

export const EMPTY_HEAD_TO_HEAD: HeadToHeadIndex = { pairs: new Map() };

export function computePointsPercentage(
  points: number,
  played: number,
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): number {
  if (played <= 0) return 0;
  const maximum = played * rules.maxPointsPerMatch;
  if (!(maximum > 0)) return 0;
  return (points / maximum) * 100;
}

/** Display helper. Ranking must use `pointsPercentage`, not this rounded string. */
export function formatPointsPercentage(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${n.toFixed(2)}%`;
}

export type NetRunRateComponents = {
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
};

/**
 * Full-precision NRR from run and over totals.
 * Display may round to three decimals; ranking must use this value.
 */
export function computeNetRunRate(row: NetRunRateComponents): number {
  if (row.oversFaced === 0 && row.oversBowled === 0) return 0;
  const scoredRate = row.oversFaced > 0 ? row.runsScored / row.oversFaced : 0;
  const concededRate = row.oversBowled > 0 ? row.runsConceded / row.oversBowled : 0;
  return scoredRate - concededRate;
}

function readNetRunRateComponents(extras: unknown): NetRunRateComponents | null {
  if (!extras || typeof extras !== "object") return null;
  const source = extras as Record<string, unknown>;
  const runsScored = Number(source.runsScored);
  const oversFaced = Number(source.oversFaced);
  const runsConceded = Number(source.runsConceded);
  const oversBowled = Number(source.oversBowled);
  if (![runsScored, oversFaced, runsConceded, oversBowled].every(Number.isFinite)) return null;
  return { runsScored, oversFaced, runsConceded, oversBowled };
}

/**
 * Ranking NRR. Prefer the persisted run/over totals over the 3-decimal column.
 * Falls back to the stored number only when those totals are absent.
 */
export function rankingNetRunRate(
  stored: number | string | null | undefined,
  extras: unknown,
): number {
  const components = readNetRunRateComponents(extras);
  if (components) return computeNetRunRate(components);
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  if (typeof stored === "string" && stored.trim() !== "") {
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Display helper. Positive rates keep a leading plus. Ranking must not use this string. */
export function formatNetRunRate(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const text = n.toFixed(3);
  return n > 0 ? `+${text}` : text;
}

function headToHeadPairKey(teamA: number, teamB: number): string {
  return teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;
}

function addPairPoints(pair: HeadToHeadPair, teamId: number, points: number, won: boolean) {
  pair.points.set(teamId, (pair.points.get(teamId) ?? 0) + points);
  if (won) pair.wins.set(teamId, (pair.wins.get(teamId) ?? 0) + 1);
}

/**
 * Aggregate head-to-head from the same matches that feed standings.
 * Abandoned / no-result meetings count as points but do not produce a winner.
 * Scheduled, live, and other non-terminal statuses are ignored.
 */
export function buildHeadToHeadIndex(
  matches: HeadToHeadMatch[],
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): HeadToHeadIndex {
  const pairs = new Map<string, HeadToHeadPair>();

  for (const match of matches) {
    if (!STANDINGS_ELIGIBLE_STATUSES.has(match.status)) continue;
    if (match.homeTeamId === match.awayTeamId) continue;

    const key = headToHeadPairKey(match.homeTeamId, match.awayTeamId);
    let pair = pairs.get(key);
    if (!pair) {
      pair = { meetings: 0, points: new Map(), wins: new Map() };
      pairs.set(key, pair);
    }
    pair.meetings += 1;

    if (match.status === "abandoned" || match.status === "no_result") {
      addPairPoints(pair, match.homeTeamId, rules.noResultPoints, false);
      addPairPoints(pair, match.awayTeamId, rules.noResultPoints, false);
      continue;
    }

    const winnerId = match.winnerTeamId;
    const isTie = match.isTie ?? winnerId == null;
    if (isTie) {
      addPairPoints(pair, match.homeTeamId, rules.tiePoints, false);
      addPairPoints(pair, match.awayTeamId, rules.tiePoints, false);
    } else if (winnerId === match.homeTeamId) {
      addPairPoints(pair, match.homeTeamId, rules.winPoints, true);
      addPairPoints(pair, match.awayTeamId, rules.lossPoints, false);
    } else if (winnerId === match.awayTeamId) {
      addPairPoints(pair, match.awayTeamId, rules.winPoints, true);
      addPairPoints(pair, match.homeTeamId, rules.lossPoints, false);
    }
  }

  return { pairs };
}

/**
 * Higher points percentage ranks first.
 * Uses cross-multiplication of points and matches played so ranking does not
 * depend on a rounded percentage. Zero matches rank as 0%.
 */
export function comparePointsPercentage(
  a: Pick<CricketStandingRankInput, "played" | "points">,
  b: Pick<CricketStandingRankInput, "played" | "points">,
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): number {
  if (!(rules.maxPointsPerMatch > 0)) return 0;
  const aPlayed = a.played > 0;
  const bPlayed = b.played > 0;
  if (!aPlayed && !bPlayed) return 0;
  if (!aPlayed) return b.points > 0 ? 1 : 0;
  if (!bPlayed) return a.points > 0 ? -1 : 0;

  const left = a.points * b.played;
  const right = b.points * a.played;
  if (left === right) return 0;
  return right > left ? 1 : -1;
}

/** 0 when the teams have not met, or the meetings do not separate them. */
export function compareHeadToHead(teamA: number, teamB: number, index: HeadToHeadIndex): number {
  const pair = index.pairs.get(headToHeadPairKey(teamA, teamB));
  if (!pair || pair.meetings === 0) return 0;
  const pointsA = pair.points.get(teamA) ?? 0;
  const pointsB = pair.points.get(teamB) ?? 0;
  if (pointsA !== pointsB) return pointsB - pointsA;
  const winsA = pair.wins.get(teamA) ?? 0;
  const winsB = pair.wins.get(teamB) ?? 0;
  if (winsA !== winsB) return winsB - winsA;
  return 0;
}

/**
 * Authoritative cricket ranking:
 * 1. Points percentage DESC
 * 2. Net run rate DESC
 * 3. Head-to-head (aggregate points, then wins, from league meetings)
 * 4. teamId ASC
 */
export function compareCricketStandings(
  a: CricketStandingRankInput,
  b: CricketStandingRankInput,
  headToHead: HeadToHeadIndex = EMPTY_HEAD_TO_HEAD,
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): number {
  const byPercentage = comparePointsPercentage(a, b, rules);
  if (byPercentage !== 0) return byPercentage;
  if (a.netRunRate !== b.netRunRate) return b.netRunRate - a.netRunRate;
  const byHeadToHead = compareHeadToHead(a.teamId, b.teamId, headToHead);
  if (byHeadToHead !== 0) return byHeadToHead;
  return a.teamId - b.teamId;
}

function sameRankingBucket(
  a: CricketStandingRankInput,
  b: CricketStandingRankInput,
  rules: CricketPointsRules,
): boolean {
  return comparePointsPercentage(a, b, rules) === 0 && a.netRunRate === b.netRunRate;
}

/**
 * Rank a standings list. Teams tied on points percentage and NRR are ordered by
 * aggregate head-to-head among that tied set, then teamId. The aggregate is a
 * total order, including when more than two teams are tied.
 */
export function rankCricketStandings<T extends CricketStandingRankInput>(
  rows: T[],
  headToHead: HeadToHeadIndex = EMPTY_HEAD_TO_HEAD,
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): Array<T & { pointsPercentage: number }> {
  const decorated = rows.map((row) => ({
    ...row,
    pointsPercentage: computePointsPercentage(row.points, row.played, rules),
  }));

  const primary = [...decorated].sort((a, b) => {
    const byPercentage = comparePointsPercentage(a, b, rules);
    if (byPercentage !== 0) return byPercentage;
    if (a.netRunRate !== b.netRunRate) return b.netRunRate - a.netRunRate;
    return a.teamId - b.teamId;
  });

  const ranked: Array<T & { pointsPercentage: number }> = [];
  let index = 0;
  while (index < primary.length) {
    let end = index + 1;
    while (end < primary.length && sameRankingBucket(primary[index]!, primary[end]!, rules)) {
      end += 1;
    }
    const cluster = primary.slice(index, end);
    if (cluster.length === 2) {
      cluster.sort((a, b) => compareCricketStandings(a, b, headToHead, rules));
    } else if (cluster.length > 2) {
      const totals = aggregateHeadToHead(cluster.map((row) => row.teamId), headToHead);
      cluster.sort((a, b) => {
        const pointsDiff = (totals.points.get(b.teamId) ?? 0) - (totals.points.get(a.teamId) ?? 0);
        if (pointsDiff !== 0) return pointsDiff;
        const winsDiff = (totals.wins.get(b.teamId) ?? 0) - (totals.wins.get(a.teamId) ?? 0);
        if (winsDiff !== 0) return winsDiff;
        return a.teamId - b.teamId;
      });
    }
    ranked.push(...cluster);
    index = end;
  }

  return ranked;
}

/**
 * Rank rows already stored by the standings rebuild.
 * NRR comes from run/over totals when `extras` has them; otherwise the stored number.
 * Head-to-head uses the same index as qualification and the main table.
 */
export function rankPersistedCricketStandings<T extends PersistedCricketStanding>(
  rows: T[],
  matches: HeadToHeadMatch[],
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): Array<Omit<T, "netRunRate" | "extras"> & { netRunRate: number; pointsPercentage: number }> {
  const prepared = rows.map((row) => {
    const { extras, netRunRate, ...rest } = row;
    return {
      ...rest,
      netRunRate: rankingNetRunRate(netRunRate, extras),
    };
  });
  return rankCricketStandings(prepared, buildHeadToHeadIndex(matches, rules), rules);
}

/** Mark the first `qualifiers` rows of an already-ranked list. Does not reorder. */
export function applyQualification<T>(
  rows: T[],
  qualifiers: number,
): Array<T & { qualified: boolean }> {
  const count = qualifiers > 0 ? qualifiers : 0;
  return rows.map((row, index) => ({ ...row, qualified: index < count }));
}

export type NormalizedCricketStanding = {
  teamId: number;
  rank: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  pointsPercentage: number;
  netRunRate: number;
  qualified: boolean | null;
};

/** Semantic standings identity. Rank is position in the supplied order, starting at 1. */
export function normalizeCricketStandings(
  rows: Array<{
    teamId: number;
    played: number;
    won: number;
    lost: number;
    tied: number;
    noResult: number;
    points: number;
    pointsPercentage: number;
    netRunRate: number;
    qualified?: boolean | null;
  }>,
): NormalizedCricketStanding[] {
  return rows.map((row, index) => ({
    teamId: row.teamId,
    rank: index + 1,
    played: row.played,
    won: row.won,
    lost: row.lost,
    tied: row.tied,
    noResult: row.noResult,
    points: row.points,
    pointsPercentage: row.pointsPercentage,
    netRunRate: row.netRunRate,
    qualified: typeof row.qualified === "boolean" ? row.qualified : null,
  }));
}

const NORMALIZED_FIELDS: Array<keyof NormalizedCricketStanding> = [
  "teamId",
  "rank",
  "played",
  "won",
  "lost",
  "tied",
  "noResult",
  "points",
  "pointsPercentage",
  "netRunRate",
  "qualified",
];

/** Compare semantic standings. Omit fields a surface does not display. */
export function sameCricketStandings(
  left: NormalizedCricketStanding[],
  right: NormalizedCricketStanding[],
  fields: Array<keyof NormalizedCricketStanding> = NORMALIZED_FIELDS,
): boolean {
  if (left.length !== right.length) return false;
  return left.every((row, index) => {
    const other = right[index];
    if (!other) return false;
    return fields.every((field) => row[field] === other[field]);
  });
}

function aggregateHeadToHead(teamIds: number[], index: HeadToHeadIndex) {
  const points = new Map<number, number>();
  const wins = new Map<number, number>();
  for (const teamId of teamIds) {
    points.set(teamId, 0);
    wins.set(teamId, 0);
  }
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const pair = index.pairs.get(headToHeadPairKey(teamIds[i]!, teamIds[j]!));
      if (!pair) continue;
      for (const teamId of [teamIds[i]!, teamIds[j]!]) {
        points.set(teamId, (points.get(teamId) ?? 0) + (pair.points.get(teamId) ?? 0));
        wins.set(teamId, (wins.get(teamId) ?? 0) + (pair.wins.get(teamId) ?? 0));
      }
    }
  }
  return { points, wins };
}

/** Convert overs string e.g. "19.3" → 19.5 (decimal balls). */
export function oversStringToDecimal(overs: string, ballsPerOver = 6): number {
  const trimmed = overs.trim();
  if (!trimmed) return 0;
  const [wholePart, ballPart] = trimmed.split(".");
  const oversWhole = Number.parseInt(wholePart ?? "0", 10);
  const balls = Number.parseInt(ballPart ?? "0", 10);
  if (Number.isNaN(oversWhole) || Number.isNaN(balls)) return 0;
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  return oversWhole + balls / bpo;
}

/** Convert decimal overs e.g. 19.5 (decimal) → "19.3" (cricket overs.balls). */
export function decimalToOversString(decimalOvers: number, ballsPerOver = 6): string {
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  const totalBalls = Math.round(decimalOvers * bpo);
  const overs = Math.floor(totalBalls / bpo);
  const balls = totalBalls % bpo;
  return `${overs}.${balls}`;
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
    pointsPercentage: 0,
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

/**
 * Apply runs and overs from completed innings to tournament NRR.
 * Complies with ICC Playing Conditions & CricHeroes NRR rules:
 * 1. Super Over innings are excluded.
 * 2. If a team is dismissed (All Out) before completing scheduled overs quota,
 *    its overs faced (and opponent's overs bowled) are credited as the full quota of overs.
 */
function applyNrrFromSummary(
  map: Map<number, TeamStandingComputed>,
  summary: CricketMatchSummary,
) {
  const matchMaxWickets = summary.maxWickets ?? 10;
  for (const inn of summary.innings) {
    // ICC & CricHeroes Rule: Super Overs are excluded from tournament NRR
    if (inn.kind === "super_over") {
      continue;
    }

    const batting = ensureTeam(map, inn.battingTeamId);
    const bowling = ensureTeam(map, inn.bowlingTeamId);

    // ICC & CricHeroes All-Out Rule: If dismissed in fewer overs, full quota of overs is credited.
    const isAllOut = inn.allOut ?? (inn.wickets >= matchMaxWickets);
    const quotaOvers = inn.oversLimit ?? summary.oversLimit;
    const actualOvers = oversStringToDecimal(inn.overs, summary.ballsPerOver ?? 6);

    const effectiveOvers = isAllOut && quotaOvers > 0 ? quotaOvers : actualOvers;

    batting.runsScored += inn.runs;
    batting.oversFaced += effectiveOvers;
    bowling.runsConceded += inn.runs;
    bowling.oversBowled += effectiveOvers;
  }
}


/**
 * Build points table from completed/abandoned matches.
 * Points follow `rules` (default: win 2, tie/no-result 1 each, loss 0).
 * In accordance with ICC rules, abandoned matches (No Result) award no-result
 * points but 0 runs and 0 overs count towards tournament Net Run Rate.
 * Ranking is points percentage, then NRR, then head-to-head, then teamId.
 */
export function buildStandingsFromMatches(
  teamIds: number[],
  matches: StandingsMatchInput[],
  rules: CricketPointsRules = DEFAULT_CRICKET_POINTS_RULES,
): TeamStandingComputed[] {
  const map = new Map<number, TeamStandingComputed>();
  for (const id of teamIds) {
    map.set(id, emptyStanding(id));
  }

  for (const match of matches) {
    const home = ensureTeam(map, match.homeTeamId);
    const away = ensureTeam(map, match.awayTeamId);

    if (match.status === "abandoned" || match.status === "no_result") {
      home.played += 1;
      away.played += 1;
      home.noResult += 1;
      away.noResult += 1;
      home.points += rules.noResultPoints;
      away.points += rules.noResultPoints;
      // ICC Rule: Abandoned / No Result matches do not contribute runs or overs to NRR
      continue;
    }

    home.played += 1;
    away.played += 1;

    const winnerId = match.summary?.winnerTeamId ?? null;
    const isTie = match.isTie ?? (winnerId === null);

    if (isTie) {
      home.tied += 1;
      away.tied += 1;
      home.points += rules.tiePoints;
      away.points += rules.tiePoints;
    } else if (winnerId === match.homeTeamId) {
      home.won += 1;
      away.lost += 1;
      home.points += rules.winPoints;
      away.points += rules.lossPoints;
    } else if (winnerId === match.awayTeamId) {
      away.won += 1;
      home.lost += 1;
      away.points += rules.winPoints;
      home.points += rules.lossPoints;
    }

    if (match.status !== "walkover" && match.summary) {
      applyNrrFromSummary(map, match.summary);
    }
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    netRunRate: computeNetRunRate(row),
    pointsPercentage: computePointsPercentage(row.points, row.played, rules),
  }));

  const headToHead = buildHeadToHeadIndex(
    matches.map((match) => ({
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      winnerTeamId: match.summary?.winnerTeamId ?? null,
      isTie: match.isTie,
    })),
    rules,
  );

  return rankCricketStandings(rows, headToHead, rules);
}
