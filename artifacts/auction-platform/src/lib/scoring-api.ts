import { apiFetch } from "@workspace/api-base";
import type {
  CricketFullScorecard,
  CricketMatchSummary,
  CricketScoreboardState,
  LeaderboardCategory,
} from "@workspace/scoring-core";

export function isTerminalCricketMatchStatus(status: string): boolean {
  return status === "completed" || status === "abandoned";
}

export type ScoringMatchJson = {
  id: number;
  tournamentId: number;
  fixtureId: number | null;
  sportSlug: string;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  roundName: string | null;
  scheduledAt: string | null;
  venue: string | null;
  rules: { overs?: number; maxWickets?: number } | null;
  winnerTeamId: number | null;
  resultSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ScoringMatchDetail = {
  match: ScoringMatchJson;
  state: CricketScoreboardState;
  summary?: CricketMatchSummary | null;
  eventCount: number;
  lastSequence: number;
};

export type ScoringLiveDisplay = {
  match: ScoringMatchJson | null;
  state: CricketScoreboardState | null;
  summary: CricketMatchSummary | null;
};

export type ScoringStandingRow = {
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number;
};

export type SquadReadinessRow = {
  teamId: number;
  name: string;
  shortCode: string;
  soldCount: number;
  retainedCount: number;
  eligibleCount: number;
  ready: boolean;
};

export type CricketTournamentRosterPlayer = {
  auctionPlayerId: number;
  masterPlayerId: string | null;
  tournamentPlayerProfileId: number | null;
  tournamentPlayerInitials: string | null;
  displayName: string;
  photoUrl: string | null;
  role: string | null;
  status: string;
  auctionTeamId: number | null;
  masterTeamId: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  syncedToMaster: boolean;
  onRoster: boolean;
};

async function parseError(r: Response): Promise<string> {
  try {
    const data = await r.json();
    return data.error ?? r.statusText;
  } catch {
    return r.statusText;
  }
}

export async function getScoringLive(tournamentId: number): Promise<ScoringLiveDisplay> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/live`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function listScoringMatches(tournamentId: number): Promise<ScoringMatchJson[]> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/matches`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function createScoringMatch(
  tournamentId: number,
  body: {
    homeTeamId: number;
    awayTeamId: number;
    oversLimit?: number;
    roundName?: string | null;
    venue?: string | null;
  },
): Promise<ScoringMatchDetail> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/matches`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function getScoringMatch(
  tournamentId: number,
  matchId: number,
): Promise<ScoringMatchDetail> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/matches/${matchId}`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function appendScoringEvent(
  tournamentId: number,
  matchId: number,
  body: {
    eventType: string;
    payload: Record<string, unknown>;
    expectedSequence: number;
    correlationId?: string;
  },
): Promise<ScoringMatchDetail & { event: { id: number; eventType: string; sequence: number } }> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/matches/${matchId}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const msg = await parseError(r);
    const err = new Error(msg) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return r.json();
}

export async function getScoringStandings(tournamentId: number): Promise<ScoringStandingRow[]> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/standings`);
  if (!r.ok) throw new Error(await parseError(r));
  const data = await r.json();
  return data.standings ?? [];
}

export async function getSquadReadiness(tournamentId: number): Promise<{
  squads: SquadReadinessRow[];
  minPlayingXi: number;
}> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/squads`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function getCricketTournamentRoster(
  tournamentId: number,
  teamId?: number,
): Promise<CricketTournamentRosterPlayer[]> {
  const teamFilter = Number.isFinite(teamId) ? `?teamId=${teamId}` : "";
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/roster${teamFilter}`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export type ScoringLeaderboardRow = {
  playerId: number;
  teamId: number;
  value: number;
  rank: number;
  playerName: string;
  teamName: string;
  shortCode: string;
};

export type PublicScorecardResponse = {
  match: {
    id: number;
    status: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: { id: number; name: string; shortCode: string } | null;
    awayTeam: { id: number; name: string; shortCode: string } | null;
    winnerTeamId: number | null;
    resultSummary: string | null;
    roundName: string | null;
    completedAt: string | null;
  };
  scorecard: CricketFullScorecard;
  players: Record<string, string>;
  manOfTheMatch?: {
    playerId: number;
    playerName: string;
    teamId: number;
    reason: string | null;
  } | null;
};

export async function getScoringLeaderboard(
  tournamentId: number,
  category: LeaderboardCategory,
  limit = 20,
): Promise<ScoringLeaderboardRow[]> {
  const r = await apiFetch(
    `/tournaments/${tournamentId}/scoring/leaderboards/${category}?limit=${limit}`,
  );
  if (!r.ok) throw new Error(await parseError(r));
  const data = await r.json();
  return data.rows ?? [];
}

export async function getPublicMatchScorecard(
  tournamentId: number,
  matchId: number,
): Promise<PublicScorecardResponse> {
  const r = await apiFetch(
    `/tournaments/${tournamentId}/scoring/matches/${matchId}/scorecard`,
  );
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export type TournamentPlayerProfile = {
  player: {
    id: number;
    name: string;
    role: string | null;
    photoUrl: string | null;
    globalPlayerId: string | null;
  };
  team: { id: number; name: string; shortCode: string; color: string | null } | null;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    strikeRate: number;
    fours: number;
    sixes: number;
    economy: number;
  } | null;
  manOfTheMatchAwards: Array<{ matchId: number; reason: string | null; awardedAt: string }>;
  recentMatches: Array<{
    id: number;
    homeTeamId: number;
    awayTeamId: number;
    status: string;
    resultSummary: string | null;
    completedAt: string | null;
  }>;
};

export async function getTournamentPlayerProfile(
  tournamentId: number,
  playerId: number,
): Promise<TournamentPlayerProfile> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/public/players/${playerId}`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export type TournamentTeamProfile = {
  team: { id: number; name: string; shortCode: string; color: string | null; logoUrl: string | null };
  standing: {
    played: number;
    won: number;
    lost: number;
    tied: number;
    noResult: number;
    points: number;
    netRunRate: number;
  } | null;
  squad: Array<{ id: number; name: string; role: string | null; status: string; soldPrice: number | null }>;
  recentResults: Array<{
    id: number;
    homeTeamId: number;
    awayTeamId: number;
    winnerTeamId: number | null;
    resultSummary: string | null;
    completedAt: string | null;
    won: boolean;
  }>;
  topBatsmen: Array<{ playerId: number; playerName: string; runs: number; matches: number; strikeRate: number }>;
};

export async function getTournamentTeamProfile(
  tournamentId: number,
  teamId: number,
): Promise<TournamentTeamProfile> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/public/teams/${teamId}`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function getGlobalCricketPlayerProfile(globalPlayerId: string) {
  const r = await apiFetch(`/global-players/${globalPlayerId}/cricket-profile`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export type GlobalLeaderboardRow = {
  rank: number;
  globalPlayerId: string;
  playerName: string;
  value: number;
};

export async function getGlobalCricketLeaderboard(
  category: LeaderboardCategory,
  limit = 20,
): Promise<GlobalLeaderboardRow[]> {
  const r = await apiFetch(`/cricket/global-leaderboards/${category}?limit=${limit}`);
  if (!r.ok) throw new Error(await parseError(r));
  const data = await r.json();
  return data.rows ?? [];
}

export async function undoScoringEvent(
  tournamentId: number,
  matchId: number,
  expectedSequence: number,
): Promise<ScoringMatchDetail & { event: { id: number; eventType: string; sequence: number } }> {
  const r = await apiFetch(`/tournaments/${tournamentId}/scoring/matches/${matchId}/undo`, {
    method: "POST",
    body: JSON.stringify({ expectedSequence }),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}
