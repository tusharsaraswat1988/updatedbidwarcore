import { apiFetch } from "@workspace/api-base/api-fetch";

/**
 * Public Cricket Adapter for Fan Platform
 * Strict read-only interface for cricket scoring data.
 */

const base = (tid: number) => `/api/tournaments/${tid}/scoring`;

export async function getLiveScoringDisplay(tournamentId: number) {
  const r = await apiFetch(`${base(tournamentId)}/live`);
  if (!r.ok) throw new Error(await r.json().then((d) => d.error) || r.statusText);
  return r.json();
}

export async function getPublicScorecard(tournamentId: number, matchId: number) {
  const r = await apiFetch(`${base(tournamentId)}/matches/${matchId}/scorecard`);
  if (!r.ok) throw new Error(await r.json().then((d) => d.error) || r.statusText);
  return r.json();
}

export async function getStandings(tournamentId: number) {
  const r = await apiFetch(`${base(tournamentId)}/standings`);
  if (!r.ok) throw new Error(await r.json().then((d) => d.error) || r.statusText);
  return r.json();
}

export async function getLeaderboard(tournamentId: number, category: string, limit = 20) {
  const r = await apiFetch(`${base(tournamentId)}/leaderboards/${category}?limit=${limit}`);
  if (!r.ok) throw new Error(await r.json().then((d) => d.error) || r.statusText);
  return r.json();
}

export function getSseUrl(tournamentId: number) {
  return `${base(tournamentId)}/events`;
}
