/** Relative path to the live auction operator room for a tournament. */
export function auctionRoomPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/auction`;
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

/** LED big-screen display path (optional auction code for public gate). */
export function displayScreenPath(
  tournamentId: number,
  auctionCode?: string | null,
): string {
  const base = `/tournament/${tournamentId}/display`;
  if (!auctionCode?.trim()) return base;
  return `${base}?code=${encodeURIComponent(auctionCode.trim())}`;
}

/** OBS browser-source overlay path. */
export function obsOverlayPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/obs`;
}

/** Mobile cricket scorer (organizer). */
export function scoringPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/score`;
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

export function openObsOverlay(tournamentId: number): void {
  window.open(obsOverlayPath(tournamentId), "_blank", "noopener,noreferrer");
}
