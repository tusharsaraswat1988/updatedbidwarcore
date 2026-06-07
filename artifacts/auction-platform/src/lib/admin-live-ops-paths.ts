export type LiveOpsSection = "monitor" | "displays" | "owner-apps" | "sessions" | "emergency";

export function tournamentLiveOpsPath(tournamentId: number, section: LiveOpsSection): string {
  return `/admin/tournaments/${tournamentId}/live/${section}`;
}

/** Maps legacy /admin/live/:section/:id bookmarks to tournament-scoped routes. */
export function legacyLiveOpsRedirect(section: LiveOpsSection, tournamentId: number): string {
  return tournamentLiveOpsPath(tournamentId, section);
}

export const LIVE_OPS_TABS: { id: LiveOpsSection; label: string }[] = [
  { id: "monitor", label: "Auction Monitor" },
  { id: "displays", label: "Connected Displays" },
  { id: "owner-apps", label: "Connected Owner Apps" },
  { id: "sessions", label: "Operator Sessions" },
  { id: "emergency", label: "Emergency Controls" },
];
