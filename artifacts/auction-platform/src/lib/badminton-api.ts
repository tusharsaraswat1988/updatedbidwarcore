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
  tournamentId: number,
  matchId: number,
  pin: string,
): Promise<boolean> {
  try {
    const result = await badmintonFetch<{ ok: boolean }>(
      tournamentId,
      `/matches/${matchId}/verify-pin`,
      { method: "POST", body: JSON.stringify({ pin }) },
    );
    return result.ok === true;
  } catch {
    return false;
  }
}

export type ScorerHomeUiStatus = "READY" | "LIVE" | "PAUSED" | "COMPLETED";

export type ScorerHomeMatchCard = {
  id: number;
  category: string | null;
  playerA: string;
  playerB: string;
  court: string | null;
  scheduledAt: string | null;
  status: ScorerHomeUiStatus;
  matchStatus: string;
  actionLabel: "Start Scoring" | "Resume" | "Read Only";
  readOnly: boolean;
};

export async function openBadmintonScorerSession(
  tournamentId: number,
  pin: string,
): Promise<{ ok: boolean; matches: ScorerHomeMatchCard[] }> {
  try {
    return await badmintonFetch<{ ok: boolean; matches: ScorerHomeMatchCard[] }>(
      tournamentId,
      `/scorer/session`,
      { method: "POST", body: JSON.stringify({ pin }) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    throw new Error(message);
  }
}

export async function fetchBadmintonScorerMatches(
  tournamentId: number,
  pin: string,
): Promise<ScorerHomeMatchCard[]> {
  const result = await badmintonFetch<{ matches: ScorerHomeMatchCard[] }>(
    tournamentId,
    `/scorer/matches`,
    {
      method: "GET",
      headers: { "x-scorer-pin": pin },
    },
  );
  return result.matches ?? [];
}
