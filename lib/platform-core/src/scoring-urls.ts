/** Canonical path prefix for the scoring app (must match vite `base` and manifest `scope`). */
export const SCORING_APP_BASE = "/scoring-app";

/**
 * Temporary host path for the Sports product UI.
 * Ownership of Mission Control is Sports — not this URL prefix.
 */
export const SPORTS_PRODUCT_HOST_BASE = SCORING_APP_BASE;

/** Prefix an auction-platform path for the external scoring app. */
export function scoringAppPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SCORING_APP_BASE}${normalized}`;
}

/**
 * Sports product home — Tournament Mission Control.
 * Temporarily hosted under /scoring-app; ownership is Sports.
 */
export function sportsMissionControlPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/mission-control`;
}

/** Absolute (host-prefixed) Sports Mission Control URL. */
export function sportsMissionControlAppPath(tournamentId: number): string {
  return scoringAppPath(sportsMissionControlPath(tournamentId));
}

/**
 * Default Sports organizer entry — Tournament Mission Control.
 * `sport` retained for callers; home is product-level, not sport-specific.
 */
export function scoringAppHomePath(tournamentId: number, _sport?: string | null): string {
  return sportsMissionControlAppPath(tournamentId);
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
