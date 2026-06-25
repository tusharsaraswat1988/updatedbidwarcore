const STORAGE_PREFIX = "bidwar:operator-pin:";

export function getLocalOperatorPin(tournamentId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${tournamentId}`);
  } catch {
    return null;
  }
}

export function setLocalOperatorPin(tournamentId: number, pin: string): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${tournamentId}`, pin.trim());
  } catch {
    // Private browsing / quota
  }
}

export function tournamentIdFromPath(pathname = window.location.pathname): number | null {
  const match = /\/tournament\/(\d+)/.exec(pathname);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function resolveLocalOperatorPin(): string | null {
  const tid = tournamentIdFromPath();
  return tid ? getLocalOperatorPin(tid) : null;
}
