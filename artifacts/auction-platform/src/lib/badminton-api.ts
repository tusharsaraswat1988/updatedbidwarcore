const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function badmintonFetch<T>(
  tournamentId: number,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}/api/tournaments/${tournamentId}/badminton${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(typeof err.error === "string" ? err.error : "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function verifyBadmintonScorerPin(
  _tournamentId: number,
  _matchId: number,
  _pin: string,
): Promise<boolean> {
  return false;
}

export type ScorerHomeUiStatus = "READY" | "LIVE" | "PAUSED" | "COMPLETED";

export type ScorerHomeMatchCard = {
  id: number;
  category: string | null;
  playerA: string;
  playerB: string;
  court: string | null;
  courtId: number | null;
  scheduledAt: string | null;
  status: ScorerHomeUiStatus;
  matchStatus: string;
  actionLabel: "Start Scoring" | "Resume" | "Read Only";
  readOnly: boolean;
  accessVia?: "match_pin" | "court_pin";
};

export type ScorerHomeCourtCard = {
  id: number;
  name: string;
  shortName: string | null;
  scorerName: string | null;
  currentMatch: ScorerHomeMatchCard | null;
  nextMatch: ScorerHomeMatchCard | null;
  matches: ScorerHomeMatchCard[];
};

export type ScorerHomeSessionPayload = {
  ok: boolean;
  matches: ScorerHomeMatchCard[];
  courts: ScorerHomeCourtCard[];
  view: "court" | "courts" | "matches";
};

export async function openBadmintonScorerSession(
  tournamentId: number,
  _pin?: string,
): Promise<ScorerHomeSessionPayload> {
  const { scorerAuthHeaders } = await import("./badminton-scorer-session");
  return badmintonFetch<ScorerHomeSessionPayload>(tournamentId, `/scorer/session`, {
    method: "GET",
    headers: scorerAuthHeaders(),
  });
}

export async function fetchBadmintonScorerSession(
  tournamentId: number,
  _pin?: string,
): Promise<ScorerHomeSessionPayload> {
  const { scorerAuthHeaders } = await import("./badminton-scorer-session");
  return badmintonFetch<ScorerHomeSessionPayload>(tournamentId, `/scorer/matches`, {
    method: "GET",
    headers: scorerAuthHeaders(),
  });
}

/** @deprecated Prefer fetchBadmintonScorerSession */
export async function fetchBadmintonScorerMatches(
  tournamentId: number,
  pin: string,
): Promise<ScorerHomeMatchCard[]> {
  const result = await fetchBadmintonScorerSession(tournamentId, pin);
  return result.matches ?? [];
}
