/**
 * Cross-app navigation after Organizer auth.
 * Same-SPA paths use the in-app router; other BidWar frontends need a full page load.
 */
export function isCrossAppOrganizerPath(path: string): boolean {
  return (
    path.startsWith("/mobile") ||
    path.startsWith("/owner-app") ||
    path.startsWith("/scoring-app")
  );
}

export function navigateAfterOrganizerAuth(
  path: string,
  navigate: (to: string) => void,
): void {
  if (!path.startsWith("/")) return;
  if (isCrossAppOrganizerPath(path)) {
    window.location.assign(path);
    return;
  }
  navigate(path);
}
