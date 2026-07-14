const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type ScorerProfile = {
  id: number;
  name: string;
  mobile: string;
};

export type ScorerLoginResult = {
  token: string;
  scorer: ScorerProfile;
  expiresAt: string;
};

export class ScorerApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ScorerApiError";
  }
}

async function parseError(res: Response): Promise<ScorerApiError> {
  const body = await res.json().catch(() => ({ error: "Request failed" }));
  const message =
    (typeof body.message === "string" && body.message) ||
    (typeof body.error === "string" && body.error) ||
    "Request failed";
  return new ScorerApiError(message, typeof body.code === "string" ? body.code : undefined, res.status);
}

export async function loginScorer(mobile: string, pin: string): Promise<ScorerLoginResult> {
  const res = await fetch(`${API_BASE}/api/scorer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, pin }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<ScorerLoginResult>;
}

export async function logoutScorer(token: string): Promise<void> {
  await fetch(`${API_BASE}/api/scorer/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export async function acquireScorerMatchLock(
  matchId: number,
  token: string,
  meta?: { tournamentId?: number; sport?: string },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/scorer/matches/${matchId}/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tournamentId: meta?.tournamentId,
      sport: meta?.sport ?? "badminton",
    }),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      code: "MATCH_LOCKED",
      message:
        (typeof body.message === "string" && body.message) ||
        "This match is currently being scored by another active session.",
    };
  }
  if (!res.ok) throw await parseError(res);
  return { ok: true };
}

export async function heartbeatScorerMatchLock(matchId: number, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/scorer/matches/${matchId}/heartbeat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await parseError(res);
}

export async function releaseScorerMatchLock(
  matchId: number,
  token: string,
  meta?: { tournamentId?: number; sport?: string },
): Promise<void> {
  const params = new URLSearchParams();
  if (meta?.tournamentId) params.set("tournamentId", String(meta.tournamentId));
  if (meta?.sport) params.set("sport", meta.sport);
  const qs = params.toString();
  await fetch(`${API_BASE}/api/scorer/matches/${matchId}/lock${qs ? `?${qs}` : ""}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export async function forceUnlockBadmintonMatch(
  tournamentId: number,
  matchId: number,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/force-unlock`,
    { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } },
  );
  if (!res.ok) throw await parseError(res);
}
