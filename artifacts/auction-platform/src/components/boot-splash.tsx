import { GlobalLoadingScreen, type GlobalLoadingScreenProps } from "./global-loading-screen";

/**
 * BootSplash — Canonical backward-compatible export of GlobalLoadingScreen.
 * Ensures any existing imports throughout BidWar get the new, theme-aware,
 * minimal, and elegant loading experience.
 */
export function BootSplash(props: GlobalLoadingScreenProps) {
  return <GlobalLoadingScreen {...props} />;
}

export { GlobalLoadingScreen };
export default GlobalLoadingScreen;
