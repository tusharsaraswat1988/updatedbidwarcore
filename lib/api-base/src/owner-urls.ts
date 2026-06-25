/** Canonical path prefix for the owner PWA (must match vite `base` and manifest `scope`). */
export const OWNER_APP_BASE = "/owner-app";

/** Owner onboarding entry — all external links (SMS, share, teams) use this. */
export function ownerJoinPath(tournamentId?: number, teamId?: number): string {
  const params = new URLSearchParams();
  if (tournamentId != null) params.set("tournamentId", String(tournamentId));
  if (teamId != null) params.set("teamId", String(teamId));
  const q = params.toString();
  return `${OWNER_APP_BASE}/join${q ? `?${q}` : ""}`;
}

/**
 * Path inside owner-app wouter (base `/owner-app`) after onboarding — access code + live bid UI.
 */
export function ownerDashboardAppPath(tournamentId: number, teamId: number): string {
  return `/tournament/${tournamentId}/owner/${teamId}`;
}

/** Wouter-relative join path (same query shape as {@link ownerJoinPath}). */
export function ownerJoinAppPath(tournamentId?: number, teamId?: number): string {
  const params = new URLSearchParams();
  if (tournamentId != null) params.set("tournamentId", String(tournamentId));
  if (teamId != null) params.set("teamId", String(teamId));
  const q = params.toString();
  return `/join${q ? `?${q}` : ""}`;
}

/** Absolute URL for SMS / copy links. */
export function ownerJoinPublicUrl(
  origin: string,
  tournamentId?: number,
  teamId?: number,
): string {
  return `${origin.replace(/\/+$/, "")}${ownerJoinPath(tournamentId, teamId)}`;
}
