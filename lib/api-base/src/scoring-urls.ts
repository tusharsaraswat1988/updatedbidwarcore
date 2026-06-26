/** Canonical path prefix for the scoring app (must match vite `base` and manifest `scope`). */
export const SCORING_APP_BASE = "/scoring-app";

/** Prefix an auction-platform path for the external scoring app. */
export function scoringAppPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SCORING_APP_BASE}${normalized}`;
}

/** Default organizer entry — cricket match list / scorer hub. */
export function scoringAppHomePath(tournamentId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/score`);
}

/** Absolute URL for SMS / copy links. */
export function scoringAppPublicUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, "")}${scoringAppPath(path)}`;
}

export function openScoringApp(tournamentId: number): void {
  window.open(scoringAppHomePath(tournamentId), "_blank", "noopener,noreferrer");
}
