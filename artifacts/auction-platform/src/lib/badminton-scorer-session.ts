/**
 * Client-side Scorer auth session — mobile + personal PIN → JWT.
 * Stored in sessionStorage (tab-scoped). Replaces court/match PIN cache.
 */

const STORAGE_KEY = "bidwar:scorer-auth:v1";

export type ScorerAuthSession = {
  token: string;
  scorer: { id: number; name: string; mobile: string };
  expiresAt: string;
  verifiedAt: number;
};

export function getScorerAuthSession(): ScorerAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScorerAuthSession>;
    if (
      typeof parsed.token !== "string" ||
      !parsed.token ||
      !parsed.scorer ||
      typeof parsed.scorer.id !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) < Date.now()) {
      clearScorerAuthSession();
      return null;
    }
    return {
      token: parsed.token,
      scorer: parsed.scorer as ScorerAuthSession["scorer"],
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : "",
      verifiedAt: typeof parsed.verifiedAt === "number" ? parsed.verifiedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function setScorerAuthSession(session: Omit<ScorerAuthSession, "verifiedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ScorerAuthSession = {
      ...session,
      verifiedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing / quota
  }
}

export function clearScorerAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** @deprecated Legacy PIN session — no longer used. */
export function getBadmintonScorerSession(_tournamentId: number): null {
  return null;
}

/** @deprecated */
export function setBadmintonScorerSession(_tournamentId: number, _pin: string): void {}

/** @deprecated */
export function clearBadmintonScorerSession(_tournamentId: number): void {
  clearScorerAuthSession();
}

export function scorerAuthHeaders(): Record<string, string> {
  const session = getScorerAuthSession();
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}
