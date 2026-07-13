/**
 * Client-side Scorer Home session — PIN entered once per tournament tab session.
 * Used by /badminton/scorer and reused by /badminton/:matchId/score so umpires
 * are not re-prompted for every match.
 */

const STORAGE_PREFIX = "bidwar:badminton-scorer-session:v1:";

export type BadmintonScorerSession = {
  pin: string;
  tournamentId: number;
  verifiedAt: number;
};

function storageKey(tournamentId: number): string {
  return `${STORAGE_PREFIX}${tournamentId}`;
}

export function getBadmintonScorerSession(tournamentId: number): BadmintonScorerSession | null {
  if (!tournamentId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(tournamentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BadmintonScorerSession>;
    if (
      typeof parsed.pin !== "string" ||
      parsed.pin.trim().length < 4 ||
      parsed.tournamentId !== tournamentId
    ) {
      return null;
    }
    return {
      pin: parsed.pin.trim(),
      tournamentId,
      verifiedAt: typeof parsed.verifiedAt === "number" ? parsed.verifiedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function setBadmintonScorerSession(tournamentId: number, pin: string): void {
  if (!tournamentId || typeof window === "undefined") return;
  const trimmed = pin.trim();
  if (trimmed.length < 4) return;
  try {
    const payload: BadmintonScorerSession = {
      pin: trimmed,
      tournamentId,
      verifiedAt: Date.now(),
    };
    sessionStorage.setItem(storageKey(tournamentId), JSON.stringify(payload));
  } catch {
    // Private browsing / quota — scoring still works for this page load.
  }
}

export function clearBadmintonScorerSession(tournamentId: number): void {
  if (!tournamentId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(tournamentId));
  } catch {
    // ignore
  }
}
