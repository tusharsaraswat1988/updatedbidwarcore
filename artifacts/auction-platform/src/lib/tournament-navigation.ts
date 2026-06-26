import { scoringAppPath } from "@workspace/api-base/scoring-urls";

/** Relative path to the live auction operator room for a tournament. */
export function auctionRoomPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/auction`;
}

/** Clear practice data page — optional `from` records where the user came from. */
export function auctionResetPath(tournamentId: number, from?: string | null): string {
  const base = `/tournament/${tournamentId}/reset`;
  if (!from?.startsWith("/") || from.startsWith("//")) return base;
  return `${base}?from=${encodeURIComponent(from)}`;
}

/** Safe return target after leaving the reset page. */
export function resolveReturnPath(from: string | null | undefined, tournamentId: number): string {
  if (from?.startsWith("/") && !from.startsWith("//")) return from;
  return setupAreaPath(tournamentId);
}

/** Short label for the reset page back button. */
export function returnPathBackLabel(path: string): string {
  if (path.includes("/settings")) return "Back to Settings";
  if (path.includes("/auction")) return "Back to Auction Room";
  if (/^\/tournament\/\d+\/?$/.test(path.replace(/\?.*$/, ""))) return "Back to Setup";
  return "Go back";
}

/**
 * Open the auction room in a new browser tab (dedicated operator surface).
 * Omits noopener so the auction tab can focus the setup tab via window.opener.
 */
export function openAuctionRoom(tournamentId: number): void {
  window.open(auctionRoomPath(tournamentId), "_blank");
}

/** Relative path to the tournament setup dashboard. */
export function setupAreaPath(tournamentId: number): string {
  return `/tournament/${tournamentId}`;
}

/** BidWar Media Center — organizer Buzz Studio hub (requires features.buzzStudio). */
export function mediaCenterPath(tournamentId: number): string {
  return `/organizer/media-center/${tournamentId}`;
}

/** Template Studio — organizer route for a specific template. */
export function templateStudioPath(
  tournamentId: number,
  templateId: string,
): string {
  return `/organizer/media-center/${tournamentId}/${templateId}`;
}

/** Canonical tournament-scoped path (alias). */
export function mediaCenterTournamentPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/media-center`;
}

/** Template Studio — tournament-scoped route for a specific template. */
export function templateStudioTournamentPath(
  tournamentId: number,
  templateId: string,
): string {
  return `/tournament/${tournamentId}/media-center/${templateId}`;
}

/** LED big-screen display path (optional auction code for public gate). */
export function displayScreenPath(
  tournamentId: number,
  auctionCode?: string | null,
): string {
  const base = `/tournament/${tournamentId}/display`;
  if (!auctionCode?.trim()) return base;
  return `${base}?code=${encodeURIComponent(auctionCode.trim())}`;
}

export type SideLedPanelMode = "sponsors" | "player";

/** Side LED panel — sponsors carousel or live player profile (ignores operator overlays). */
export function sideDisplayPath(
  tournamentId: number,
  panel: SideLedPanelMode = "player",
  auctionCode?: string | null,
): string {
  const params = new URLSearchParams({ panel });
  if (auctionCode?.trim()) {
    params.set("code", auctionCode.trim());
  }
  return `/tournament/${tournamentId}/side-display?${params.toString()}`;
}

/** Public live auction viewer — shareable, no auction code required. */
export function liveViewerPath(tournamentId: number): string {
  return `/live/${tournamentId}`;
}

/** @deprecated Use liveViewerPath — kept for backward-compatible bookmarks. */
export function legacyLiveViewerPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/liveviewer`;
}

/** Broadcast Overlay path (internal `/obs` route; browser-source for streaming). */
export function obsOverlayPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/obs`;
}

/** @alias obsOverlayPath */
export const broadcastOverlayPath = obsOverlayPath;

/** Mobile cricket scorer (organizer) — external scoring app. */
export function scoringPath(tournamentId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/score`);
}

/** Tournament schedule generator (organizer) — external scoring app. */
export function scoringSchedulePath(tournamentId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/score/schedule`);
}

/** Public cricket tournament page (fans) — external scoring app. */
export function cricketPublicPath(tournamentId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/cricket`);
}

/** Public full scorecard for a completed match. */
export function cricketMatchPublicPath(tournamentId: number, matchId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/cricket/match/${matchId}`);
}

/** Public tournament player profile. */
export function cricketPlayerPublicPath(tournamentId: number, playerId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/cricket/player/${playerId}`);
}

/** Public tournament team profile. */
export function cricketTeamPublicPath(tournamentId: number, teamId: number): string {
  return scoringAppPath(`/tournament/${tournamentId}/cricket/team/${teamId}`);
}

/** Global cricket player career profile. */
export function globalCricketPlayerPath(globalPlayerId: string): string {
  return scoringAppPath(`/player/${globalPlayerId}`);
}

/** Global cricket career leaderboards. */
export function globalCricketLeaderboardsPath(): string {
  return scoringAppPath("/cricket/leaderboards");
}

/** LED cricket scoreboard (public, optional auction code) — external scoring app. */
export function scoreDisplayPath(
  tournamentId: number,
  auctionCode?: string | null,
): string {
  const base = scoringAppPath(`/tournament/${tournamentId}/score-display`);
  if (!auctionCode?.trim()) return base;
  return `${base}?code=${encodeURIComponent(auctionCode.trim())}`;
}

export function openScoreDisplay(
  tournamentId: number,
  auctionCode?: string | null,
): void {
  window.open(
    scoreDisplayPath(tournamentId, auctionCode),
    "_blank",
    "noopener,noreferrer",
  );
}

/** Open setup in the opener tab when launched from Setup; otherwise new tab. */
export function openSetupArea(tournamentId: number): void {
  const path = setupAreaPath(tournamentId);
  if (window.opener && !window.opener.closed) {
    window.opener.location.href = path;
    window.opener.focus();
    return;
  }
  window.open(path, "_blank", "noopener,noreferrer");
}

export function openDisplayScreen(
  tournamentId: number,
  auctionCode?: string | null,
): void {
  window.open(
    displayScreenPath(tournamentId, auctionCode),
    "_blank",
    "noopener,noreferrer",
  );
}

export function openSideDisplayScreen(
  tournamentId: number,
  panel: SideLedPanelMode = "player",
  auctionCode?: string | null,
): void {
  window.open(
    sideDisplayPath(tournamentId, panel, auctionCode),
    "_blank",
    "noopener,noreferrer",
  );
}

export function openObsOverlay(tournamentId: number): void {
  window.open(obsOverlayPath(tournamentId), "_blank", "noopener,noreferrer");
}

/** @alias openObsOverlay */
export const openBroadcastOverlay = openObsOverlay;
