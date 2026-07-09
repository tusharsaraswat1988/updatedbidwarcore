import { isBidWarLocalHost } from "@/lib/local-mode-host";

/** Organizer pages needed to run a venue auction offline. */
const LOCAL_ORGANIZER_SEGMENTS = new Set([
  "teams",
  "players",
  "categories",
  "settings",
  "auction",
  "reset",
  "reports",
  "team-reports",
  "links",
  "fortune-wheel",
  "break-timer",
]);

/** Public broadcast / owner entry — no cloud account required. */
const LOCAL_PUBLIC_SEGMENTS = new Set([
  "display",
  "side-display",
  "obs",
  "obs/preview",
  "obs/v2",
  "obs/v2/preview",
  "obs/lab",
  "obs/lab/preview",
  "liveviewer",
]);

function normalizePath(pathname: string): string {
  const bare = pathname.split("?")[0].split("#")[0].replace(/\/$/, "");
  return bare || "/";
}

export function parseLocalVenueTournamentId(pathname: string): number | null {
  const match = normalizePath(pathname).match(/^\/tournament\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * True when the SPA path is allowed on BidWar Local (port 3741).
 * Blocks marketing, admin, organizer account portal, registration, etc.
 */
export function isLocalVenueAllowedPath(pathname: string): boolean {
  if (!isBidWarLocalHost()) return true;

  const path = normalizePath(pathname);

  if (path.startsWith("/owner-app")) return true;

  if (path === "/live") return true;

  const liveMatch = path.match(/^\/live\/(\d+)$/);
  if (liveMatch) return true;

  const ownerMatch = path.match(/^\/tournament\/(\d+)\/owner\/(\d+)$/);
  if (ownerMatch) return true;

  const tid = parseLocalVenueTournamentId(path);
  if (!tid) return false;

  if (path === `/tournament/${tid}`) return true;

  const rest = path.slice(`/tournament/${tid}/`.length);
  if (!rest) return true;

  if (LOCAL_ORGANIZER_SEGMENTS.has(rest)) return true;

  if (LOCAL_PUBLIC_SEGMENTS.has(rest)) return true;

  return false;
}

export function localVenueRedirectPath(
  pathname: string,
  defaultTournamentId: number | null,
): string {
  const fromPath = parseLocalVenueTournamentId(pathname);
  const tid = fromPath ?? defaultTournamentId;
  if (tid) return `/tournament/${tid}/auction`;
  return "/";
}

export function isLocalVenueOrganizerPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  const tid = parseLocalVenueTournamentId(path);
  if (!tid) return false;
  if (path === `/tournament/${tid}`) return true;
  const rest = path.slice(`/tournament/${tid}/`.length);
  return LOCAL_ORGANIZER_SEGMENTS.has(rest);
}
