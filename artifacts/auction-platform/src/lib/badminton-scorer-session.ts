/**
 * Client-side Scorer auth session — mobile + personal PIN → JWT.
 * Stored in sessionStorage (tab-scoped). Replaces court/match PIN cache.
 */

const STORAGE_KEY = "bidwar:scorer-auth:v1";

export type ScorerAuthSession = {
  token: string;
  scorer: { id: number; name: string; mobile: string; isActive?: boolean };
  /** False when account is deactivated — view scores/schedules only. */
  canScore: boolean;
  expiresAt: string;
  verifiedAt: number;
};

export function getScorerAuthSession(): ScorerAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage may fail in restricted/incognito modes
    }
    if (!raw) {
      try {
        raw = sessionStorage.getItem(STORAGE_KEY);
      } catch {
        // sessionStorage fallback
      }
    }
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
    const canScore =
      typeof parsed.canScore === "boolean"
        ? parsed.canScore
        : parsed.scorer.isActive !== false;
    const result: ScorerAuthSession = {
      token: parsed.token,
      scorer: parsed.scorer as ScorerAuthSession["scorer"],
      canScore,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : "",
      verifiedAt: typeof parsed.verifiedAt === "number" ? parsed.verifiedAt : Date.now(),
    };
    // Keep storages in sync if read from one but missing from another
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {}
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {}
    return result;
  } catch {
    return null;
  }
}

export function setScorerAuthSession(session: Omit<ScorerAuthSession, "verifiedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ScorerAuthSession = {
      ...session,
      canScore: session.canScore !== false,
      verifiedAt: Date.now(),
    };
    const serialized = JSON.stringify(payload);
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch {}
    try {
      sessionStorage.setItem(STORAGE_KEY, serialized);
    } catch {}
  } catch {
    // Private browsing / quota
  }
}

/** Sync canScore after Scorer Home /me refresh (e.g. organizer deactivated account). */
export function patchScorerAuthCanScore(canScore: boolean): void {
  const existing = getScorerAuthSession();
  if (!existing) return;
  setScorerAuthSession({
    token: existing.token,
    scorer: { ...existing.scorer, isActive: canScore },
    canScore,
    expiresAt: existing.expiresAt,
  });
}

export function clearScorerAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
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
