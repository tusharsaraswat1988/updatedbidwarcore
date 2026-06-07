import { apiFetch } from "@workspace/api-base";
import type { CricketMatchSummary, CricketScoreboardState } from "@workspace/scoring-core";

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
