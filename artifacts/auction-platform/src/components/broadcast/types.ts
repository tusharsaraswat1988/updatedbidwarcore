import type { AuctionState } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";

/** Scene identifiers — extensible for future ceremony scenes. */
export type BroadcastSceneId =
  | "WAITING"
  | "AUCTION"
  | "SOLD"
  | "UNSOLD"
  | "BREAK"
  | "SUMMARY";

export type BroadcastTheme = "premium-dark" | "gold" | "crimson";

export type BroadcastSettings = {
  enableSoldAnimation: boolean;
  soldAnimationDurationMs: number;
  enableBreakMode: boolean;
  breakCountdownSeconds: number;
  theme: BroadcastTheme;
  sponsorRotationSpeedSec: number;
  autoSummary: boolean;
  /** When true, reduce blur/shadows for OBS Browser Source performance. */
  obsPerformanceMode: boolean;
};

export const DEFAULT_BROADCAST_SETTINGS: BroadcastSettings = {
  enableSoldAnimation: true,
  soldAnimationDurationMs: 3000,
  enableBreakMode: true,
  breakCountdownSeconds: 300,
  theme: "premium-dark",
  sponsorRotationSpeedSec: 4,
  autoSummary: true,
  obsPerformanceMode: true,
};

export type OutcomeSnapshot = {
  outcome: "sold" | "unsold";
  playerName: string;
  photoUrl?: string | null;
  amount?: number;
  teamName?: string;
  teamColor: string;
  teamLogoUrl?: string | null;
  reason?: string | null;
};

export type BidTimelineEntry = {
  id: string;
  teamName: string;
  teamColor: string | null;
  amount: number;
  at: number;
};

export type SummaryStats = {
  playersSold: number;
  playersUnsold: number;
  remainingPlayers: number;
  highestBid: number;
  highestBidPlayer?: string | null;
  topBuyerName?: string | null;
  topBuyerSpend: number;
  highestTeamSpend: number;
  highestTeamName?: string | null;
};

export type BroadcastSceneContext = {
  tournamentId: number;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  sponsorLogos: SponsorLogo[];
  state: AuctionState | undefined;
  settings: BroadcastSettings;
  isObsMode: boolean;
  formatAmount: (n: number) => string;
  bidTimeline: BidTimelineEntry[];
  summaryStats: SummaryStats | null;
  outcomeSnapshot: OutcomeSnapshot | null;
  breakEndsAt: string | null;
  breakMessage: string | null;
  isStaleFeed: boolean;
};

export type BroadcastSceneDefinition = {
  id: BroadcastSceneId;
  /** How long to hold this scene before auto-transition (ms). 0 = no auto exit. */
  holdMs: number;
};

export type BroadcastSceneEngineState = {
  scene: BroadcastSceneId;
  previousScene: BroadcastSceneId | null;
  sceneContext: BroadcastSceneContext;
  isTransitioning: boolean;
};
