import { normalizeMatchStatePairSeparators } from "@workspace/badminton-core";
import type { BroadcastConsoleMatch } from "@/lib/badminton-broadcast-console";

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
    const message =
      (typeof err.error === "string" && err.error) ||
      (typeof err.message === "string" && err.message) ||
      "Request failed";
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Match list with legacy " / " pair labels normalized to " & ". */
export async function fetchBadmintonMatches(
  tournamentId: number,
): Promise<BroadcastConsoleMatch[]> {
  const rows = await badmintonFetch<BroadcastConsoleMatch[]>(
    tournamentId,
    `/matches`,
  );
  return rows.map((m) =>
    m.state
      ? { ...m, state: normalizeMatchStatePairSeparators(m.state) }
      : m,
  );
}

/**
 * @deprecated Court/match PIN login was replaced by scorer JWT (mobile + personal PIN).
 * Kept as a no-op stub so legacy imports compile; always returns false.
 */
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
  /** Organizer/fixture match number for scorer identification. */
  matchNumber?: string | null;
  category: string | null;
  playerA: string;
  playerB: string;
  teamA?: string | null;
  teamB?: string | null;
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
  /** False when scorer account is deactivated — browse only. */
  canScore?: boolean;
  scorer?: {
    id: number;
    name: string;
    mobile: string;
    isActive: boolean;
  };
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
