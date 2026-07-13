/**
 * Results & Standings — read-only helpers.
 * Consumes completed matches / fixtures. Never edits scoring.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import { matchDisplayLabel } from "@/lib/badminton-control-center";

export type ResultsMatch = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  roundName?: string | null;
  resultSummary?: string | null;
  fixtureId?: number | null;
  detail: Record<string, unknown> | null;
  state: BadmintonMatchState | null;
};

export type ResultsCategory = {
  id: number;
  name: string;
  code?: string | null;
  matchType?: string;
  drawType?: string;
  phase?: string;
  sortOrder?: number;
};

export type ResultsFixture = {
  id: number;
  categoryId: number;
  drawId: number;
  slotNumber?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
  winnerAdvancesTo?: number | null;
  loserAdvancesTo?: number | null;
  scoringMatchId?: number | null;
  courtId?: number | null;
  scheduledAt?: string | null;
  status: string;
  winnerRegistrationId?: number | null;
  resultSummary?: string | null;
};

export type ResultsCollection = {
  id: number;
  categoryId: number;
  roundName: string;
  roundNumber?: number | null;
  totalRounds?: number | null;
  drawKind?: string;
  status?: string;
};

export type ChampionInfo = {
  categoryId: number;
  categoryName: string;
  winnerLabel: string;
  roundLabel: string;
  gamesWonLine: string;
  gameScoreLines: string[];
  matchId: number;
  outcomeLabel: string;
};

export type CategoryResultsBlock = {
  category: ResultsCategory;
  champion: ChampionInfo | null;
  live: ResultsMatch[];
  upcoming: ResultsMatch[];
  upcomingFixtures: ResultsFixture[];
  completed: ResultsMatch[];
  remainingCount: number;
  collections: ResultsCollection[];
  fixtures: ResultsFixture[];
  hasProgressionLinks: boolean;
};

function categoryIdOf(m: ResultsMatch): number | null {
  const id = m.detail?.categoryId;
  return typeof id === "number" ? id : null;
}

function roundLabelOf(m: ResultsMatch): string {
  const fromDetail = m.detail?.roundName;
  if (typeof fromDetail === "string" && fromDetail.trim()) return fromDetail.trim();
  if (typeof m.roundName === "string" && m.roundName.trim()) return m.roundName.trim();
  return "";
}

export function isCompletedMatch(m: ResultsMatch): boolean {
  return m.status === "completed";
}

export function isLiveMatch(m: ResultsMatch): boolean {
  return m.status === "live";
}

export function isUpcomingMatch(m: ResultsMatch): boolean {
  return m.status === "scheduled";
}

export function completedAtMs(m: ResultsMatch): number {
  const raw =
    m.completedAt ||
    m.state?.endedAt ||
    m.scheduledAt ||
    null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function scheduledMs(m: ResultsMatch): number {
  if (!m.scheduledAt) return Number.MAX_SAFE_INTEGER;
  const t = new Date(m.scheduledAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function isSameLocalDay(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function winnerLabel(m: ResultsMatch): string | null {
  const side = m.state?.winnerSide;
  if (!side || !m.state) return null;
  const info = side === "left" ? m.state.leftSide : m.state.rightSide;
  return info.label?.trim() || info.shortLabel?.trim() || null;
}

export function gamesWonLine(m: ResultsMatch): string {
  if (!m.state) return "—";
  return `${m.state.gamesLeft}–${m.state.gamesRight}`;
}

export function gameScoreLines(m: ResultsMatch): string[] {
  if (!m.state?.games?.length) return [];
  return m.state.games
    .filter((g) => g.phase === "completed" || g.winner)
    .map((g) => `${g.leftScore}–${g.rightScore}`);
}

export function outcomeLabel(m: ResultsMatch): string {
  const status = m.state?.matchStatus;
  const reason = m.state?.resultReason;
  if (status === "walkover" || reason === "walkover") return "Walkover";
  if (status === "retired" || reason === "retirement") return "Retired";
  if (status === "disqualified" || reason === "disqualification") return "Disqualified";
  if (status === "abandoned" || reason === "abandoned") return "Abandoned";
  return "Completed";
}

export function formatCompletedWhen(m: ResultsMatch): string {
  const raw = m.completedAt || m.state?.endedAt || m.scheduledAt;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Who won today? — completed matches finishing today. */
export function listWonToday(matches: ResultsMatch[], limit = 12): ResultsMatch[] {
  return matches
    .filter((m) => {
      if (!isCompletedMatch(m)) return false;
      return (
        isSameLocalDay(m.completedAt) ||
        isSameLocalDay(m.state?.endedAt) ||
        (!m.completedAt && !m.state?.endedAt && isSameLocalDay(m.scheduledAt))
      );
    })
    .sort((a, b) => completedAtMs(b) - completedAtMs(a))
    .slice(0, limit);
}

/** Who is playing now? */
export function listPlayingNow(matches: ResultsMatch[]): ResultsMatch[] {
  return matches.filter(isLiveMatch).sort((a, b) => a.id - b.id);
}

function openFixture(f: ResultsFixture): boolean {
  if (f.scoringMatchId != null) return false;
  return f.status !== "walkover" && f.status !== "cancelled" && f.status !== "completed";
}

/** Who is left? — scheduled matches + open fixtures still to play. */
export function listRemaining(
  matches: ResultsMatch[],
  fixtures: ResultsFixture[],
): { matches: ResultsMatch[]; fixtures: ResultsFixture[]; total: number } {
  const upcoming = matches
    .filter(isUpcomingMatch)
    .sort((a, b) => scheduledMs(a) - scheduledMs(b));
  const open = fixtures
    .filter(openFixture)
    .sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  return { matches: upcoming, fixtures: open, total: upcoming.length + open.length };
}

function isFinalRoundName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (/semi|quarter|consolation|bronze|play.?off|group/.test(n)) return false;
  return /\bfinals?\b/.test(n) || n === "final";
}

/**
 * Champion detection (no new engine):
 * Category is finished when phase=completed OR no remaining matches/open fixtures.
 * Prefer Final-round completed match; else latest completed with a winner.
 */
export function detectCategoryChampion(
  category: ResultsCategory,
  matches: ResultsMatch[],
  fixtures: ResultsFixture[],
): ChampionInfo | null {
  const catMatches = matches.filter((m) => categoryIdOf(m) === category.id);
  const catFixtures = fixtures.filter((f) => f.categoryId === category.id);

  const remainingMatches = catMatches.filter(
    (m) => isLiveMatch(m) || isUpcomingMatch(m),
  );
  const remainingFixtures = catFixtures.filter(openFixture);
  const finished =
    category.phase === "completed" ||
    (remainingMatches.length === 0 && remainingFixtures.length === 0);

  if (!finished) return null;

  const completed = catMatches
    .filter((m) => isCompletedMatch(m) && m.state?.winnerSide)
    .sort((a, b) => completedAtMs(b) - completedAtMs(a));

  if (completed.length === 0) return null;

  const finalMatch =
    completed.find((m) => isFinalRoundName(roundLabelOf(m))) ??
    completed.find((m) => {
      const fix = catFixtures.find((f) => f.scoringMatchId === m.id);
      return fix != null && fix.winnerAdvancesTo == null;
    }) ??
    completed[0];

  const winner = winnerLabel(finalMatch);
  if (!winner) return null;

  const round = roundLabelOf(finalMatch) || "Final";

  return {
    categoryId: category.id,
    categoryName: category.code?.trim() || category.name,
    winnerLabel: winner,
    roundLabel: round,
    gamesWonLine: gamesWonLine(finalMatch),
    gameScoreLines: gameScoreLines(finalMatch),
    matchId: finalMatch.id,
    outcomeLabel: outcomeLabel(finalMatch),
  };
}

export function hasProgressionLinks(fixtures: ResultsFixture[]): boolean {
  return fixtures.some((f) => f.winnerAdvancesTo != null || f.loserAdvancesTo != null);
}

const ROUND_RANK: Array<{ re: RegExp; rank: number }> = [
  { re: /round\s*of\s*64|r64/i, rank: 10 },
  { re: /round\s*of\s*32|r32/i, rank: 20 },
  { re: /round\s*of\s*16|r16|pre.?quarter/i, rank: 30 },
  { re: /quarter|qf/i, rank: 40 },
  { re: /semi|sf/i, rank: 50 },
  { re: /bronze|3rd|consolation/i, rank: 55 },
  { re: /\bfinals?\b/i, rank: 60 },
];

function collectionSortKey(c: ResultsCollection): number {
  if (typeof c.roundNumber === "number" && c.roundNumber > 0) return c.roundNumber * 100;
  for (const { re, rank } of ROUND_RANK) {
    if (re.test(c.roundName)) return rank;
  }
  return 1000 + c.id;
}

export type BracketRoundOverlay = {
  collection: ResultsCollection;
  fixtures: Array<{
    fixture: ResultsFixture;
    match: ResultsMatch | null;
    label: string;
    resultLine: string | null;
    winner: string | null;
  }>;
};

/** Overlay completed results onto fixture collections — no fake edges. */
export function buildBracketOverlay(
  collections: ResultsCollection[],
  fixtures: ResultsFixture[],
  matches: ResultsMatch[],
  sideLabel?: (registrationId: number | null | undefined) => string,
): BracketRoundOverlay[] {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const sorted = [...collections].sort(
    (a, b) => collectionSortKey(a) - collectionSortKey(b) || a.id - b.id,
  );

  return sorted.map((collection) => {
    const rows = fixtures
      .filter((f) => f.drawId === collection.id)
      .sort((a, b) => (a.slotNumber ?? a.id) - (b.slotNumber ?? b.id))
      .map((fixture) => {
        const match =
          fixture.scoringMatchId != null
            ? matchById.get(fixture.scoringMatchId) ?? null
            : null;
        let label: string;
        if (match) {
          label = matchDisplayLabel(match);
        } else {
          const a = sideLabel?.(fixture.registrationAId) ?? (fixture.registrationAId ? `Entry #${fixture.registrationAId}` : "TBD");
          const b = sideLabel?.(fixture.registrationBId) ?? (fixture.registrationBId ? `Entry #${fixture.registrationBId}` : "TBD");
          label = `${a} vs ${b}`;
        }
        const winner = match && isCompletedMatch(match) ? winnerLabel(match) : null;
        const resultLine =
          match && isCompletedMatch(match)
            ? `${gamesWonLine(match)}${
                gameScoreLines(match).length
                  ? ` (${gameScoreLines(match).join(", ")})`
                  : ""
              }`
            : null;
        return { fixture, match, label, resultLine, winner };
      });

    return { collection, fixtures: rows };
  });
}

export function buildCategoryResultsBlocks(
  categories: ResultsCategory[],
  matches: ResultsMatch[],
  fixtures: ResultsFixture[],
  collections: ResultsCollection[],
): CategoryResultsBlock[] {
  const sortedCats = [...categories].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name),
  );

  return sortedCats.map((category) => {
    const catMatches = matches.filter((m) => categoryIdOf(m) === category.id);
    const catFixtures = fixtures.filter((f) => f.categoryId === category.id);
    const catCollections = collections.filter((c) => c.categoryId === category.id);
    const live = catMatches.filter(isLiveMatch);
    const upcoming = catMatches
      .filter(isUpcomingMatch)
      .sort((a, b) => scheduledMs(a) - scheduledMs(b));
    const upcomingFixtures = catFixtures.filter(openFixture);
    const completed = catMatches
      .filter(isCompletedMatch)
      .sort((a, b) => completedAtMs(b) - completedAtMs(a));

    return {
      category,
      champion: detectCategoryChampion(category, matches, fixtures),
      live,
      upcoming,
      upcomingFixtures,
      completed,
      remainingCount: upcoming.length + live.length + upcomingFixtures.length,
      collections: catCollections,
      fixtures: catFixtures,
      hasProgressionLinks: hasProgressionLinks(catFixtures),
    };
  });
}

export function categoryDisplayName(c: ResultsCategory): string {
  return c.code?.trim() || c.name;
}
