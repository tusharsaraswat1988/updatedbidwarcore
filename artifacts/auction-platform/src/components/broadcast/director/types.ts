import type { Player, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { PresentationContext, BroadcastCurrentContext } from "@/lib/presentation-context";
import type { Top5SceneModel, TeamOverviewModel } from "./context-resolver";
import type { BroadcastSceneId, BroadcastSettings, BroadcastTheme } from "../types";

/** Supported render targets — each adapter maps the same frame without duplicating logic. */
export type BroadcastOutputTarget =
  | "obs"
  | "led"
  | "public-display"
  | "mobile-viewer"
  | "website-embed"
  | "replay"
  | "ai-highlights";

export type BroadcastEventType =
  | "auction.tick"
  | "bid.placed"
  | "player.changed"
  | "player.sold"
  | "player.unsold"
  | "break.started"
  | "break.ended"
  | "auction.started"
  | "auction.paused"
  | "auction.completed"
  | "scene.transition"
  | "feed.stale"
  | "feed.recovered";

export type BroadcastEvent = {
  id: string;
  type: BroadcastEventType;
  at: number;
  payload?: Record<string, unknown>;
};

export type BroadcastThemePalette = {
  theme: BroadcastTheme;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  bg: string;
  vignette: string;
};

export type BroadcastLayoutModel = {
  canvasWidth: number;
  canvasHeight: number;
  safeInsetX: number;
  safeInsetY: number;
  contentTop: number;
  contentLeft: number;
  contentRight: number;
  contentBottom: number;
  bottomRibbonHeight: number;
};

export type BroadcastChromeModel = {
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  sponsorLogos: SponsorLogo[];
  sponsorRotationMs: number;
  themeAccent: string;
  showTopBar: boolean;
  showSponsorTicker: boolean;
  showConnectionBanner: boolean;
};

export type BroadcastWidgetSlot =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "lower-third"
  | "center"
  | "side-panel";

export type BroadcastWidgetPlacement = {
  id: string;
  slot: BroadcastWidgetSlot;
  visible: boolean;
  zIndex: number;
};

export type BroadcastCameraFeedSlot = {
  id: string;
  label: string;
  sourceUrl: string | null;
  visible: boolean;
  rect: { x: number; y: number; width: number; height: number } | null;
};

export type BroadcastTransitionModel = {
  from: BroadcastSceneId | null;
  to: BroadcastSceneId;
  active: boolean;
  durationMs: number;
};

export type BroadcastAudioCueKind =
  | "sold"
  | "unsold"
  | "countdown-tick"
  | "break-music-start"
  | "break-music-stop"
  | "scene-enter";

export type BroadcastAudioCue = {
  id: string;
  kind: BroadcastAudioCueKind;
  sceneId: BroadcastSceneId;
  fireOnce: boolean;
};

export type PlayerCardModel = {
  name: string;
  photoUrl: string | null;
  photoSrc: string | null;
  category: string | null;
  city: string | null;
  basePriceLabel: string;
  playerTag: string | null;
  accentColor: string;
};

export type BidTimelineItemModel = {
  id: string;
  teamName: string;
  teamColor: string | null;
  amountLabel: string;
};

export type AuctionSceneModel = {
  kind: "AUCTION";
  player: PlayerCardModel | null;
  phase: "live" | "up-next";
  bidLabel: string;
  bidAmountLabel: string;
  bidTeamName: string | null;
  bidTeamLogoSrc: string | null;
  bidColor: string;
  timerEndsAt: string | null;
  bidTimeline: BidTimelineItemModel[];
  remainingPoolLabel: string;
  showBidPulse: boolean;
};

export type SoldSceneModel = {
  kind: "SOLD";
  player: PlayerCardModel;
  soldPriceLabel: string;
  soldAmount: number;
  teamName: string;
  teamColor: string;
  teamLogoSrc: string | null;
};

export type UnsoldSceneModel = {
  kind: "UNSOLD";
  player: PlayerCardModel;
  reason: string | null;
};

export type BreakSceneModel = {
  kind: "BREAK";
  breakEndsAt: string;
  breakMessage: string | null;
  sponsorNames: string[];
  websiteLabel: string;
  socialLabel: string;
  showQr: boolean;
};

export type WaitingSceneModel = {
  kind: "WAITING";
  tournamentLogoSrc: string | null;
  countdownTargetIso: string | null;
  standbyLabel: string;
};

export type SummaryStatModel = {
  label: string;
  value: string;
};

export type SummarySceneModel = {
  kind: "SUMMARY";
  title: string;
  stats: SummaryStatModel[];
};

export type BroadcastSceneModel =
  | AuctionSceneModel
  | SoldSceneModel
  | UnsoldSceneModel
  | BreakSceneModel
  | WaitingSceneModel
  | SummarySceneModel;

/** Fully prepared render model — scenes are dumb views of this frame. */
export type BroadcastFrame = {
  frameId: string;
  sceneId: BroadcastSceneId;
  currentContext: BroadcastCurrentContext;
  outputTarget: BroadcastOutputTarget;
  transition: BroadcastTransitionModel;
  layout: BroadcastLayoutModel;
  chrome: BroadcastChromeModel;
  palette: BroadcastThemePalette;
  scene: BroadcastSceneModel;
  top5: Top5SceneModel | null;
  team: TeamOverviewModel | null;
  teamOverviews: TeamOverviewModel[];
  widgets: BroadcastWidgetPlacement[];
  cameraFeeds: BroadcastCameraFeedSlot[];
  preloadUrls: string[];
  audioCues: BroadcastAudioCue[];
  obsPerformanceMode: boolean;
  isStaleFeed: boolean;
  settings: BroadcastSettings;
};

export type DirectorContext = {
  tournamentId: number;
  outputTarget: BroadcastOutputTarget;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  auctionStartsAt: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  isObsMode: boolean;
  isStaleFeed: boolean;
  formatAmount: (n: number) => string;
  resolvePhotoSrc: (url: string | null | undefined, preset: "playerCard" | "soldCard" | "teamLogo" | "headerLogo") => string | null;
  /** Raw auction snapshot — director derives events from this. */
  auctionStatus: string;
  currentPlayerId: number | null;
  currentBid: number | null;
  currentBidTeamId: number | null;
  currentBidTeamName: string | null;
  currentBidTeamColor: string | null;
  currentBidTeamLogoUrl: string | null;
  timerEndsAt: string | null;
  remainingPlayersCount: number | null;
  currentCategoryName: string | null;
  playerName: string | null;
  playerPhotoUrl: string | null;
  playerRole: string | null;
  playerCity: string | null;
  playerBasePrice: number | null;
  playerTag: string | null;
  displayIsBreak: boolean;
  breakEndsAt: string | null;
  breakMessage: string | null;
  outcomeType: "sold" | "unsold" | null;
  outcomeKey: string | null;
  outcomeIsManual: boolean;
  soldPlayerName: string | null;
  soldPhotoUrl: string | null;
  soldAmount: number | null;
  soldTeamName: string | null;
  soldTeamColor: string | null;
  soldTeamLogoUrl: string | null;
  unsoldPlayerName: string | null;
  unsoldPhotoUrl: string | null;
  summarySold: number;
  summaryUnsold: number;
  summaryRemaining: number;
  summaryHighestBid: number;
  summaryHighestBidPlayer: string | null;
  summaryTopBuyerName: string | null;
  summaryTopBuyerSpend: number;
  summaryHighestTeamSpend: number;
  summaryHighestTeamName: string | null;
  presentationContext: PresentationContext;
  teamPurses: TeamPurse[] | undefined;
  soldPlayers: Player[] | undefined;
  nowMs: number;
};

export type DirectorTickResult = {
  frame: BroadcastFrame;
  /** Remaining ephemeral scene hold time (ms). 0 = none. */
  sceneHoldMs: number;
  /** Total ephemeral hold duration when hold started (ms). */
  sceneHoldDurationMs: number;
  /** Scene to return to after hold completes. */
  returnSceneId: BroadcastSceneId | null;
};
