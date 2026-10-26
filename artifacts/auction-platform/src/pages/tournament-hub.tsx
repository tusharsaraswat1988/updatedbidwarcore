/**
 * Compatibility alias: TournamentHub exports AuctionOverview.
 *
 * Canonical Auction Overview route: /tournament/:id/auction-overview
 * Compatibility alias route: /tournament/:id/overview
 * Legacy URL /tournament/:id redirects to module landing (tournament-home.tsx)
 *
 * Follows Mandatory Correction 4: single Auction Overview implementation.
 */
export { default } from "./auction-overview";
