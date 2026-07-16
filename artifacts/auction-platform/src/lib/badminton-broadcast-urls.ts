import { scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import { LIVE_FOLLOW_MATCH_SEGMENT } from "@/lib/badminton-broadcast-console";
import { badmintonResultsPath, badmintonScorerHomePath } from "@/lib/badminton-routes";

export type BadmintonBroadcastKind = "display" | "overlay-compact" | "overlay-full" | "scorer";

export type TournamentBroadcastLinkKind =
  | "venue-display"
  | "obs-overlay"
  | "scorer-home"
  | "public-results";

/** In-app path for wouter Link (no /scoring-app prefix — base is applied by the router). */
export function badmintonBroadcastPath(tournamentId: number, matchId?: number) {
  const base = `/tournament/${tournamentId}/badminton/broadcast`;
  return matchId ? `${base}?match=${matchId}` : base;
}

/** Recommended scorer entry — one link + PIN for all assigned matches. */
export function badmintonScorerHomePublicUrl(
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return scoringAppPublicUrl(origin, badmintonScorerHomePath(tournamentId));
}

/** Persistent Venue Scoreboard Display — auto-follows Primary Broadcast / sole LIVE match. */
export function badmintonTournamentDisplayUrl(
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return scoringAppPublicUrl(
    origin,
    `/badminton/${LIVE_FOLLOW_MATCH_SEGMENT}/display?tid=${tournamentId}`,
  );
}

/** Persistent OBS Overlay — auto-follows Primary Broadcast / sole LIVE match. */
export function badmintonTournamentOverlayUrl(
  tournamentId: number,
  type: "compact" | "full" = "compact",
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return scoringAppPublicUrl(
    origin,
    `/badminton/${LIVE_FOLLOW_MATCH_SEGMENT}/overlay?tid=${tournamentId}&type=${type}`,
  );
}

export function badmintonTournamentResultsUrl(
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return scoringAppPublicUrl(origin, badmintonResultsPath(tournamentId));
}

export function badmintonTournamentBroadcastLinkUrl(
  kind: TournamentBroadcastLinkKind,
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  switch (kind) {
    case "venue-display":
      return badmintonTournamentDisplayUrl(tournamentId, origin);
    case "obs-overlay":
      return badmintonTournamentOverlayUrl(tournamentId, "compact", origin);
    case "scorer-home":
      return badmintonScorerHomePublicUrl(tournamentId, origin);
    case "public-results":
      return badmintonTournamentResultsUrl(tournamentId, origin);
  }
}

export function badmintonBroadcastUrl(
  kind: BadmintonBroadcastKind,
  matchId: number,
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  switch (kind) {
    case "display":
      return scoringAppPublicUrl(origin, `/badminton/${matchId}/display?tid=${tournamentId}`);
    case "overlay-compact":
      return scoringAppPublicUrl(origin, `/badminton/${matchId}/overlay?tid=${tournamentId}&type=compact`);
    case "overlay-full":
      return scoringAppPublicUrl(origin, `/badminton/${matchId}/overlay?tid=${tournamentId}&type=full`);
    case "scorer":
      // Keep per-match URL for compatibility; Scorer Home is preferred in share helpers.
      return scoringAppPublicUrl(origin, `/badminton/${matchId}/score?tid=${tournamentId}`);
  }
}

export function badmintonQrImageUrl(targetUrl: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
}

/** Persistent organizer Tournament Summary & Awards page. */
export function badmintonTournamentSummaryUrl(
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return scoringAppPublicUrl(origin, `/tournament/${tournamentId}/badminton/summary`);
}
