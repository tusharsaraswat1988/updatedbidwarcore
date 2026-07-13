/** Canonical path prefix for the scoring app (must match vite `base` and manifest `scope`). */
export const SCORING_APP_BASE = "/scoring-app";

/** Prefix an auction-platform path for the external scoring app. */
export function scoringAppPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SCORING_APP_BASE}${normalized}`;
}

/** Default organizer entry — sport-aware hub (cricket match list or badminton command center). */
export function scoringAppHomePath(tournamentId: number, sport?: string | null): string {
  if (sport === "badminton") {
    return scoringAppPath(`/tournament/${tournamentId}/badminton`);
  }
  return scoringAppPath(`/tournament/${tournamentId}/score`);
}

/** Absolute URL for SMS / copy links. */
export function scoringAppPublicUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, "")}${scoringAppPath(path)}`;
}

export function openScoringApp(tournamentId: number, sport?: string | null): void {
  const browserWindow = globalThis as typeof globalThis & {
    open?: (url: string, target?: string, features?: string) => void;
  };
  browserWindow.open?.(
    scoringAppHomePath(tournamentId, sport),
    "_blank",
    "noopener,noreferrer",
  );
}
