import type { TeamPurseSnapshot } from "./team-purse-snapshot";

export type BidTier = { upTo?: number; increment: number };

/** Tournament fields used across state build — fetched once per static cache entry. */
export type CachedTournamentSettings = {
  playerSelectionMode: string | null;
  timerSeconds: number | null;
  bidTimerSeconds: number | null;
  bidExtensionEnabled: boolean | null;
  bidExtensionThresholdSeconds: number | null;
  bidExtensionSeconds: number | null;
  bidTier1UpTo: number | null;
  bidTier1Increment: number | null;
  bidTier2UpTo: number | null;
  bidTier2Increment: number | null;
  bidTier3Increment: number | null;
  bidTiers: string | null;
  licenseStatus: string | null;
  minimumSquadSize: number | null;
  maximumSquadSize: number | null;
  minBid: number | null;
  sponsorLogos: string | null;
};

export type CachedTeamRow = {
  id: number;
  name: string;
  shortCode: string;
  color: string | null;
  logoUrl: string | null;
  purse: number;
  purseUsed: number;
};

export type CachedRosterPlayer = {
  id: number;
  name: string;
  status: string;
  teamId: number | null;
  basePrice: number;
  soldPrice: number | null;
  retainedPrice: number | null;
  isNonPlayingMember: boolean | null;
};

export type PlayerStatusCounts = {
  soldCount: number;
  unsoldCount: number;
  availableCount: number;
};

interface StaticCacheEntry {
  tournament: CachedTournamentSettings;
  tiers: BidTier[];
  cachedAt: number;
}

interface RosterCacheEntry {
  teams: CachedTeamRow[];
  counts: PlayerStatusCounts;
  rosterPlayers: CachedRosterPlayer[];
  purses: TeamPurseSnapshot[];
  cachedAt: number;
}

const staticCache = new Map<number, StaticCacheEntry>();
const rosterCache = new Map<number, RosterCacheEntry>();

export type AuctionBuildCacheScope = "static" | "roster" | "all";

export function invalidateAuctionBuildCache(
  tournamentId: number,
  scope: AuctionBuildCacheScope = "all",
): void {
  if (scope === "all" || scope === "static") staticCache.delete(tournamentId);
  if (scope === "all" || scope === "roster") rosterCache.delete(tournamentId);
}

export function getCachedStatic(tournamentId: number): StaticCacheEntry | null {
  return staticCache.get(tournamentId) ?? null;
}

export function setCachedStatic(tournamentId: number, entry: Omit<StaticCacheEntry, "cachedAt">): void {
  staticCache.set(tournamentId, { ...entry, cachedAt: Date.now() });
}

export function getCachedRoster(tournamentId: number): RosterCacheEntry | null {
  return rosterCache.get(tournamentId) ?? null;
}

export function setCachedRoster(tournamentId: number, entry: Omit<RosterCacheEntry, "cachedAt">): void {
  rosterCache.set(tournamentId, { ...entry, cachedAt: Date.now() });
}

/** Step timings for buildAuctionState profiling. */
export type AuctionStateBuildTimings = {
  session: number;
  tournament: number;
  settings: number;
  teams: number;
  players: number;
  currentPlayer: number;
  currentBid: number;
  purses: number;
  sponsors: number;
  serialization: number;
  other: number;
  total: number;
  cacheHits: { static: boolean; roster: boolean };
};

export function createBuildTimings(): AuctionStateBuildTimings {
  return {
    session: 0,
    tournament: 0,
    settings: 0,
    teams: 0,
    players: 0,
    currentPlayer: 0,
    currentBid: 0,
    purses: 0,
    sponsors: 0,
    serialization: 0,
    other: 0,
    total: 0,
    cacheHits: { static: false, roster: false },
  };
}

const FLAME_LABELS: Array<[keyof AuctionStateBuildTimings, string]> = [
  ["players", "Players"],
  ["teams", "Teams"],
  ["currentPlayer", "CurrentPlayer"],
  ["currentBid", "CurrentBid"],
  ["purses", "Purses"],
  ["sponsors", "Sponsors"],
  ["settings", "Settings"],
  ["serialization", "Serialization"],
  ["session", "Session"],
  ["other", "Other"],
];

export function formatAuctionStateFlamegraph(timings: AuctionStateBuildTimings): string {
  const lines = FLAME_LABELS.map(([key, label]) => {
    const ms = timings[key] as number;
    const dots = Math.max(1, Math.round(ms / 10));
    return `${label.padEnd(16)} ${".".repeat(Math.min(dots, 40))} ${ms} ms`;
  });
  const cacheNote = [
    timings.cacheHits.static ? "static✓" : "static✗",
    timings.cacheHits.roster ? "roster✓" : "roster✗",
  ].join(" ");
  lines.push(`Total${" ".repeat(11)} ${".".repeat(Math.min(40, Math.round(timings.total / 10)))} ${timings.total} ms  [${cacheNote}]`);
  return lines.join("\n");
}

export function resetAuctionBuildCacheForTests(): void {
  staticCache.clear();
  rosterCache.clear();
}
