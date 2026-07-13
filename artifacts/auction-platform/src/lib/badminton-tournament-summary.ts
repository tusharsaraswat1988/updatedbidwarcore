/**
 * Tournament Summary & Awards — read-only aggregates from completed matches.
 * Reuses Results helpers. Does not change scoring or lifecycle.
 */

import {
  identityFromSideInfo,
  formatTeamPlayerLine,
  type TeamPlayerIdentity,
} from "@/lib/team-player-identity";
import {
  buildCategoryResultsBlocks,
  completedAtMs,
  detectCategoryChampion,
  gameScoreLines,
  gamesWonLine,
  isCompletedMatch,
  outcomeLabel,
  type ChampionInfo,
  type ResultsCategory,
  type ResultsCollection,
  type ResultsFixture,
  type ResultsMatch,
} from "@/lib/badminton-results";
import { matchDisplayLabel } from "@/lib/badminton-control-center";

export type SummaryChampion = ChampionInfo & {
  runnerUpLabel: string | null;
  winnerIdentity: TeamPlayerIdentity | null;
  runnerUpIdentity: TeamPlayerIdentity | null;
  scoreLine: string;
};

export type CourtPerformance = {
  courtKey: string;
  courtLabel: string;
  matchesPlayed: number;
  totalCourtTimeMs: number;
  averageMatchTimeMs: number | null;
  longest: TimedMatchRef | null;
  shortest: TimedMatchRef | null;
  walkovers: number;
  timeline: TimedMatchRef[];
};

export type TimedMatchRef = {
  matchId: number;
  label: string;
  courtLabel: string;
  durationMs: number | null;
  startedAt: string | null;
  endedAt: string | null;
  outcome: string;
};

export type TimelineEvent = {
  id: string;
  atMs: number;
  atLabel: string;
  title: string;
  detail: string;
};

export type TournamentAward = {
  id: string;
  title: string;
  value: string;
  detail?: string;
};

export type TournamentSummaryStats = {
  players: number;
  teams: number;
  events: number;
  courts: number;
  fixtures: number;
  matches: number;
  completedMatches: number;
  walkovers: number;
  retirements: number;
};

export type TournamentSummaryModel = {
  stats: TournamentSummaryStats;
  champions: SummaryChampion[];
  courts: CourtPerformance[];
  timeline: TimelineEvent[];
  awards: TournamentAward[];
  isTournamentComplete: boolean;
  openingMatch: TimedMatchRef | null;
  finalMatch: TimedMatchRef | null;
};

function categoryIdOf(m: ResultsMatch): number | null {
  const id = m.detail?.categoryId;
  return typeof id === "number" ? id : null;
}

export function matchDurationMs(m: ResultsMatch): number | null {
  const startRaw = m.state?.startedAt ?? (m as { startedAt?: string | null }).startedAt ?? null;
  const endRaw =
    m.state?.endedAt ??
    m.completedAt ??
    (m as { completedAt?: string | null }).completedAt ??
    null;
  if (!startRaw || !endRaw) {
    if (typeof m.state?.elapsedMs === "number" && m.state.elapsedMs > 0) {
      return m.state.elapsedMs;
    }
    return null;
  }
  const start = new Date(startRaw).getTime();
  const end = new Date(endRaw).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return end - start;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatSummaryWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMatchDates(matchDates: string | null | undefined): string {
  if (!matchDates?.trim()) return "—";
  const parts = matchDates
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((iso) => {
      const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    });
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} – ${parts[parts.length - 1]}`;
}

export function courtLabelOf(m: ResultsMatch): string {
  const num = (m.detail?.courtNumber as string | undefined)?.trim();
  if (num) return num.toLowerCase().startsWith("court") ? num : `Court ${num}`;
  if (m.detail?.courtId != null) return `Court ${String(m.detail.courtId)}`;
  return "Unassigned";
}

function courtKeyOf(m: ResultsMatch): string {
  if (m.detail?.courtId != null) return `id:${m.detail.courtId}`;
  const num = (m.detail?.courtNumber as string | undefined)?.trim();
  if (num) return `num:${num.toLowerCase()}`;
  return "unassigned";
}

function isWalkover(m: ResultsMatch): boolean {
  return outcomeLabel(m) === "Walkover";
}

function isRetirement(m: ResultsMatch): boolean {
  return outcomeLabel(m) === "Retired";
}

function toTimedRef(m: ResultsMatch): TimedMatchRef {
  return {
    matchId: m.id,
    label: matchDisplayLabel(m),
    courtLabel: courtLabelOf(m),
    durationMs: matchDurationMs(m),
    startedAt: m.state?.startedAt ?? null,
    endedAt: m.state?.endedAt ?? m.completedAt ?? null,
    outcome: outcomeLabel(m),
  };
}

function loserIdentity(m: ResultsMatch): TeamPlayerIdentity | null {
  if (!m.state?.winnerSide) return null;
  const loser = m.state.winnerSide === "left" ? m.state.rightSide : m.state.leftSide;
  return identityFromSideInfo(loser);
}

function winnerIdentity(m: ResultsMatch): TeamPlayerIdentity | null {
  if (!m.state?.winnerSide) return null;
  const side = m.state.winnerSide === "left" ? m.state.leftSide : m.state.rightSide;
  return identityFromSideInfo(side);
}

function findChampionMatch(
  category: ResultsCategory,
  matches: ResultsMatch[],
  fixtures: ResultsFixture[],
): ResultsMatch | null {
  const champ = detectCategoryChampion(category, matches, fixtures);
  if (!champ) return null;
  return matches.find((m) => m.id === champ.matchId) ?? null;
}

export function buildSummaryChampions(
  categories: ResultsCategory[],
  matches: ResultsMatch[],
  fixtures: ResultsFixture[],
): SummaryChampion[] {
  const blocks = buildCategoryResultsBlocks(categories, matches, fixtures, []);
  return blocks
    .filter((b) => b.champion)
    .map((b) => {
      const champion = b.champion!;
      const match = findChampionMatch(b.category, matches, fixtures);
      const winId = match ? winnerIdentity(match) : null;
      const loseId = match ? loserIdentity(match) : null;
      const scores = champion.gameScoreLines;
      return {
        ...champion,
        runnerUpLabel: loseId ? formatTeamPlayerLine(loseId) : null,
        winnerIdentity: winId,
        runnerUpIdentity: loseId,
        scoreLine:
          scores.length > 0
            ? `${champion.gamesWonLine} (${scores.join(", ")})`
            : champion.gamesWonLine,
      };
    });
}

function countUniqueTeams(matches: ResultsMatch[], players: Array<{ franchiseName?: string | null; teamName?: string | null }>): number {
  const names = new Set<string>();
  for (const p of players) {
    const n = p.franchiseName?.trim() || p.teamName?.trim();
    if (n) names.add(n.toLowerCase());
  }
  for (const m of matches) {
    if (!m.state) continue;
    for (const side of [m.state.leftSide, m.state.rightSide]) {
      const id = identityFromSideInfo(side);
      if (id.teamName?.trim()) names.add(id.teamName.trim().toLowerCase());
    }
  }
  return names.size;
}

export function buildCourtPerformance(matches: ResultsMatch[]): CourtPerformance[] {
  const completed = matches.filter(isCompletedMatch);
  const byCourt = new Map<string, ResultsMatch[]>();
  for (const m of completed) {
    const key = courtKeyOf(m);
    const list = byCourt.get(key) ?? [];
    list.push(m);
    byCourt.set(key, list);
  }

  const rows: CourtPerformance[] = [];
  for (const [courtKey, list] of byCourt) {
    const timed = list
      .map(toTimedRef)
      .sort((a, b) => {
        const ta = a.startedAt ? new Date(a.startedAt).getTime() : completedAtMs(list.find((m) => m.id === a.matchId)!);
        const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return ta - tb;
      });
    const withDuration = timed.filter((t) => t.durationMs != null && (t.durationMs as number) > 0) as Array<
      TimedMatchRef & { durationMs: number }
    >;
    const totalCourtTimeMs = withDuration.reduce((sum, t) => sum + t.durationMs, 0);
    const longest =
      withDuration.length > 0
        ? withDuration.reduce((a, b) => (b.durationMs > a.durationMs ? b : a))
        : null;
    const shortest =
      withDuration.length > 0
        ? withDuration.reduce((a, b) => (b.durationMs < a.durationMs ? b : a))
        : null;

    rows.push({
      courtKey,
      courtLabel: list[0] ? courtLabelOf(list[0]) : courtKey,
      matchesPlayed: list.length,
      totalCourtTimeMs,
      averageMatchTimeMs:
        withDuration.length > 0 ? Math.round(totalCourtTimeMs / withDuration.length) : null,
      longest,
      shortest,
      walkovers: list.filter(isWalkover).length,
      timeline: timed,
    });
  }

  return rows.sort(
    (a, b) =>
      b.matchesPlayed - a.matchesPlayed ||
      a.courtLabel.localeCompare(b.courtLabel, undefined, { numeric: true }),
  );
}

export function buildTournamentTimeline(
  matches: ResultsMatch[],
  isComplete: boolean,
): TimelineEvent[] {
  const completed = matches.filter(isCompletedMatch);
  const events: TimelineEvent[] = [];

  const byStart = [...completed].sort((a, b) => {
    const ta = a.state?.startedAt ? new Date(a.state.startedAt).getTime() : completedAtMs(a);
    const tb = b.state?.startedAt ? new Date(b.state.startedAt).getTime() : completedAtMs(b);
    return ta - tb || a.id - b.id;
  });

  const opening = byStart[0];
  if (opening) {
    const at = opening.state?.startedAt || opening.completedAt || opening.scheduledAt;
    events.push({
      id: "opening",
      atMs: at ? new Date(at).getTime() : completedAtMs(opening),
      atLabel: formatSummaryWhen(at),
      title: "Opening Match",
      detail: `${matchDisplayLabel(opening)} · ${courtLabelOf(opening)}`,
    });
  }

  const firstWalkover = [...completed]
    .filter(isWalkover)
    .sort((a, b) => completedAtMs(a) - completedAtMs(b))[0];
  if (firstWalkover) {
    events.push({
      id: "first-walkover",
      atMs: completedAtMs(firstWalkover),
      atLabel: formatSummaryWhen(firstWalkover.completedAt || firstWalkover.state?.endedAt),
      title: "First Walkover",
      detail: matchDisplayLabel(firstWalkover),
    });
  }

  const withDur = completed
    .map((m) => ({ m, d: matchDurationMs(m) }))
    .filter((x): x is { m: ResultsMatch; d: number } => x.d != null && x.d > 0);
  if (withDur.length > 0) {
    const longest = withDur.reduce((a, b) => (b.d > a.d ? b : a));
    events.push({
      id: "longest",
      atMs: completedAtMs(longest.m),
      atLabel: formatSummaryWhen(longest.m.completedAt || longest.m.state?.endedAt),
      title: "Longest Match",
      detail: `${matchDisplayLabel(longest.m)} · ${formatDuration(longest.d)}`,
    });
  }

  const byEnd = [...completed].sort((a, b) => completedAtMs(a) - completedAtMs(b));
  const finalMatch = byEnd[byEnd.length - 1];
  if (finalMatch) {
    events.push({
      id: "final-match",
      atMs: completedAtMs(finalMatch),
      atLabel: formatSummaryWhen(finalMatch.completedAt || finalMatch.state?.endedAt),
      title: "Final Match",
      detail: `${matchDisplayLabel(finalMatch)} · ${courtLabelOf(finalMatch)}`,
    });
  }

  if (isComplete && finalMatch) {
    events.push({
      id: "completed",
      atMs: completedAtMs(finalMatch) + 1,
      atLabel: formatSummaryWhen(finalMatch.completedAt || finalMatch.state?.endedAt),
      title: "Tournament Completed",
      detail: "All events finished — archive ready.",
    });
  }

  return events.sort((a, b) => a.atMs - b.atMs);
}

export function buildTournamentAwards(
  matches: ResultsMatch[],
  courts: CourtPerformance[],
): TournamentAward[] {
  const completed = matches.filter(isCompletedMatch);
  const withDur = completed
    .map((m) => ({ m, d: matchDurationMs(m) }))
    .filter((x): x is { m: ResultsMatch; d: number } => x.d != null && x.d > 0);

  const awards: TournamentAward[] = [];

  if (withDur.length > 0) {
    const longest = withDur.reduce((a, b) => (b.d > a.d ? b : a));
    const fastest = withDur.reduce((a, b) => (b.d < a.d ? b : a));
    awards.push({
      id: "longest-match",
      title: "Longest Match",
      value: matchDisplayLabel(longest.m),
      detail: `${formatDuration(longest.d)} · ${courtLabelOf(longest.m)}`,
    });
    awards.push({
      id: "fastest-match",
      title: "Fastest Match",
      value: matchDisplayLabel(fastest.m),
      detail: `${formatDuration(fastest.d)} · ${courtLabelOf(fastest.m)}`,
    });
  }

  if (courts.length > 0) {
    const mostActive = [...courts].sort(
      (a, b) => b.totalCourtTimeMs - a.totalCourtTimeMs || b.matchesPlayed - a.matchesPlayed,
    )[0];
    const mostMatches = [...courts].sort((a, b) => b.matchesPlayed - a.matchesPlayed)[0];
    awards.push({
      id: "most-active-court",
      title: "Most Active Court",
      value: mostActive.courtLabel,
      detail: `${formatDuration(mostActive.totalCourtTimeMs)} total · ${mostActive.matchesPlayed} matches`,
    });
    awards.push({
      id: "most-matches-played",
      title: "Most Matches Played",
      value: mostMatches.courtLabel,
      detail: `${mostMatches.matchesPlayed} completed`,
    });

    const mostWo = [...courts].sort((a, b) => b.walkovers - a.walkovers)[0];
    awards.push({
      id: "most-walkovers",
      title: "Most Walkovers",
      value: mostWo.walkovers > 0 ? mostWo.courtLabel : "None",
      detail: mostWo.walkovers > 0 ? `${mostWo.walkovers} walkover${mostWo.walkovers === 1 ? "" : "s"}` : "No walkovers recorded",
    });
  }

  return awards;
}

export function isTournamentFullyComplete(
  categories: ResultsCategory[],
  matches: ResultsMatch[],
  fixtures: ResultsFixture[],
): boolean {
  if (categories.length === 0) return false;
  const hasPlay =
    matches.some(isCompletedMatch) ||
    matches.some((m) => m.status === "live" || m.status === "scheduled") ||
    fixtures.length > 0;
  if (!hasPlay) return false;

  const blocks = buildCategoryResultsBlocks(categories, matches, fixtures, []);
  if (blocks.length === 0) return false;
  return blocks.every(
    (b) =>
      b.remainingCount === 0 &&
      (b.champion != null || b.completed.length > 0 || b.fixtures.length === 0),
  );
}

export function buildTournamentSummary(input: {
  categories: ResultsCategory[];
  matches: ResultsMatch[];
  fixtures: ResultsFixture[];
  collections?: ResultsCollection[];
  courtsCount: number;
  playersCount: number;
  players?: Array<{ franchiseName?: string | null; teamName?: string | null }>;
}): TournamentSummaryModel {
  const { categories, matches, fixtures, courtsCount, playersCount } = input;
  const completed = matches.filter(isCompletedMatch);
  const champions = buildSummaryChampions(categories, matches, fixtures);
  const courts = buildCourtPerformance(matches);
  const isComplete = isTournamentFullyComplete(categories, matches, fixtures);

  const stats: TournamentSummaryStats = {
    players: playersCount,
    teams: countUniqueTeams(matches, input.players ?? []),
    events: categories.length,
    courts: courtsCount,
    fixtures: fixtures.length,
    matches: matches.length,
    completedMatches: completed.length,
    walkovers: completed.filter(isWalkover).length,
    retirements: completed.filter(isRetirement).length,
  };

  const byStart = [...completed].sort((a, b) => {
    const ta = a.state?.startedAt ? new Date(a.state.startedAt).getTime() : completedAtMs(a);
    const tb = b.state?.startedAt ? new Date(b.state.startedAt).getTime() : completedAtMs(b);
    return ta - tb;
  });
  const byEnd = [...completed].sort((a, b) => completedAtMs(a) - completedAtMs(b));

  return {
    stats,
    champions,
    courts,
    timeline: buildTournamentTimeline(matches, isComplete),
    awards: buildTournamentAwards(matches, courts),
    isTournamentComplete: isComplete,
    openingMatch: byStart[0] ? toTimedRef(byStart[0]) : null,
    finalMatch: byEnd[byEnd.length - 1] ? toTimedRef(byEnd[byEnd.length - 1]) : null,
  };
}

/** Score line helper for champion cards when state is present. */
export function championScoreFromMatch(m: ResultsMatch | null): string {
  if (!m) return "—";
  const scores = gameScoreLines(m);
  const games = gamesWonLine(m);
  return scores.length ? `${games} (${scores.join(", ")})` : games;
}
