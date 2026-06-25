/** True when the SPA is served by BidWar Local (default port 3741). */
export function isBidWarLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.port === "3741";
}
