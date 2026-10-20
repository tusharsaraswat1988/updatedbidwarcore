/**
 * Auction organiser pages that share AppLayout.
 * Auction Control, scoring, OBS, and public surfaces stay outside this shell.
 */

const AUCTION_MODULE_SEGMENTS = new Set([
  "auction-overview",
  "overview",
  "teams",
  "categories",
  "players",
  "reset",
  "reports",
  "links",
  "fortune-wheel",
  "break-timer",
  "local-mode",
]);

export type AuctionOrganizerShellMatch = {
  tournamentId: number;
  /** Home and settings stay module-neutral. Other shell pages require auction. */
  requiredModule?: "auction";
};

export function parseAuctionOrganizerShell(pathname: string): AuctionOrganizerShellMatch | null {
  const path = (pathname.split("?")[0] ?? pathname).split("#")[0] ?? pathname;
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const match = normalized.match(/^\/tournament\/(\d+)(?:\/([^/]+))?$/);
  if (!match) return null;

  const tournamentId = parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(tournamentId) || tournamentId <= 0) return null;

  const segment = match[2] ?? "";
  if (segment === "") {
    return { tournamentId };
  }
  if (segment === "settings") {
    return { tournamentId };
  }
  if (!AUCTION_MODULE_SEGMENTS.has(segment)) return null;

  return { tournamentId, requiredModule: "auction" };
}
