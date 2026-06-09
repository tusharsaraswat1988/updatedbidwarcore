import { apiFetch } from "@workspace/api-base";

export type ScoringVenue = {
  id: number;
  tournamentId: number;
  name: string;
  city: string | null;
  address: string | null;
  surfaceType: string | null;
  status: string;
  sortOrder: number;
};

export type ScoringOfficial = {
  id: number;
  tournamentId: number;
  name: string;
  role: string;
  mobile: string | null;
  email: string | null;
};

export type ScoringDraw = {
  id: number;
  tournamentId: number;
  name: string;
  format: string;
  status: string;
  configJson: Record<string, unknown> | null;
  createdAt: string;
};

export type ScoringFixture = {
  id: number;
  tournamentId: number;
  drawId: number | null;
  groupId: number | null;
  fixtureNumber: number | null;
  roundName: string | null;
  scheduledAt: string | null;
  venueId: number | null;
  venue: string | null;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  winnerTeamId: number | null;
  resultSummary: string | null;
};

export type MatchSquadJson = {
  playingXi: number[];
  bench: number[];
  battingOrder?: number[];
  captainId?: number | null;
  wicketKeeperId?: number | null;
};

async function parseError(r: Response): Promise<string> {
  try {
    const data = await r.json();
    return data.error ?? r.statusText;
  } catch {
    return r.statusText;
  }
}

const base = (tid: number) => `/tournaments/${tid}/scoring`;

export async function listVenues(tournamentId: number): Promise<ScoringVenue[]> {
  const r = await apiFetch(`${base(tournamentId)}/venues`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function createVenue(
  tournamentId: number,
  body: { name: string; city?: string | null },
): Promise<ScoringVenue> {
  const r = await apiFetch(`${base(tournamentId)}/venues`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function listOfficials(tournamentId: number): Promise<ScoringOfficial[]> {
  const r = await apiFetch(`${base(tournamentId)}/officials`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function createOfficial(
  tournamentId: number,
  body: { name: string; role?: string },
): Promise<ScoringOfficial> {
  const r = await apiFetch(`${base(tournamentId)}/officials`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function listDraws(tournamentId: number): Promise<ScoringDraw[]> {
  const r = await apiFetch(`${base(tournamentId)}/draws`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function listFixtures(tournamentId: number, drawId?: number): Promise<ScoringFixture[]> {
  const q = drawId != null ? `?drawId=${drawId}` : "";
  const r = await apiFetch(`${base(tournamentId)}/fixtures${q}`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function generateDraw(
  tournamentId: number,
  body: {
    name: string;
    format: "round_robin" | "league" | "knockout" | "league_knockout";
    teamIds: number[];
    groups?: Array<{ name: string; teamIds: number[] }>;
    oversLimit?: number;
    venueId?: number | null;
    startDate?: string | null;
    matchesPerDay?: number;
    createMatches?: boolean;
  },
) {
  const r = await apiFetch(`${base(tournamentId)}/draws/generate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function getMatchSquads(tournamentId: number, matchId: number) {
  const r = await apiFetch(`${base(tournamentId)}/matches/${matchId}/squads`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function setMatchSquad(
  tournamentId: number,
  matchId: number,
  teamId: number,
  squad: MatchSquadJson,
) {
  const r = await apiFetch(`${base(tournamentId)}/matches/${matchId}/squads/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(squad),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function getPublicSchedule(tournamentId: number) {
  const r = await apiFetch(`${base(tournamentId)}/public/schedule`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}
