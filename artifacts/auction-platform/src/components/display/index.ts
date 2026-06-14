// Barrel exports for the /components/display broadcast module.
// Import surface kept narrow on purpose — pages should reach for
// DisplayShell only; individual leaves are re-exported for future
// composition (livestream graphics, multi-screen broadcasts, etc.).
export { DisplayShell } from "./display-shell";
export { SideDisplayShell } from "./side-display-shell";
export { StaticBackground } from "./static-background";
export { AuctionHeader } from "./auction-header";
export { PlayerCard } from "./player-card";
export { BidDisplay } from "./bid-display";
export { AuctionCountdown } from "./auction-countdown";
export { AnimatedEffectsLayer } from "./animated-effects-layer";
export { SoldStamp, SoldCard } from "./sold-animation";
export { SponsorCarousel } from "./sponsor-carousel";
export { SponsorTicker } from "./sponsor-ticker";
export { DisplayFooter } from "./display-footer";
export { IdleScreen } from "./idle-screen";
export { OverlayManager } from "./overlay-manager";
export { TeamOverlay } from "./team-overlay";
export { PlayerOverlay } from "./player-overlay";
export { Top5Overlay } from "./top5-overlay";
export { AuctionStatusOverlay } from "./auction-status-overlay";
export { DisplayConnectionBanner } from "./display-connection-banner";
export { OutcomeResultPanel } from "./outcome-result-panel";
export type { OutcomeResultData } from "./outcome-result-panel";
export { FortuneWheelOverlay } from "./fortune-wheel-overlay";
export { useSoldAnimation } from "./use-sold-animation";
export { playSoldAudio } from "./sold-audio";
export type {
  WheelItem,
  SoldRecord,
  PurseRow,
  PlayerLite,
  CategoryLite,
  DisplayPlayerFilter,
} from "./types";
