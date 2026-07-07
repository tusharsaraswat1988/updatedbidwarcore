import type { AuctionState, Player, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { BroadcastSceneId, BroadcastSettings } from "../types";
import type { BidTimelineItemModel, DirectorContext } from "./types";

type DirectorStateSnapshot = {
  sceneId: BroadcastSceneId;
  previousSceneId: BroadcastSceneId | null;
  isTransitioning: boolean;
  inEphemeralHold: boolean;
  ephemeralReturnSceneId: BroadcastSceneId | null;
  ephemeralHoldKey: string | null;
  bidTimeline: BidTimelineItemModel[];
};

/** React-side key — triggers director tick only when auction-driven inputs change. */
export function computeAuctionInputKey(input: {
  tournamentId: number;
  outputTarget?: string;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  auctionStartsAt: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  isObsMode: boolean;
  isStaleFeed: boolean;
  state: AuctionState | undefined;
  teamPurses: TeamPurse[] | undefined;
  soldPlayers?: Player[] | undefined;
  presentationContext?: unknown;
  displayIsBreak: boolean;
  breakEndsAt: string | null | undefined;
  breakMessage: string | null | undefined;
  outcomeKey: string | null;
  summarySold: number;
  summaryUnsold: number;
  summaryRemaining: number;
  summaryHighestBid: number;
  summaryTopBuyerName: string | null;
  summaryHighestTeamSpend: number;
}): string {
  const s = input.state;
  const player = s?.currentPlayer;
  const parts = [
    input.tournamentId,
    input.outputTarget ?? "obs",
    input.tournamentName ?? "",
    input.tournamentLogoUrl ?? "",
    input.auctionStartsAt ?? "",
    input.isObsMode ? "1" : "0",
    input.isStaleFeed ? "1" : "0",
    input.settings.theme,
    input.settings.sponsorRotationSpeedSec,
    input.settings.obsPerformanceMode ? "1" : "0",
    JSON.stringify(input.sponsorLogos.map((l) => l.url ?? l.name ?? "")),
    s?.status ?? "",
    player?.id ?? "",
    s?.currentBid ?? "",
    s?.currentBidTeamId ?? "",
    s?.currentBidTeamName ?? "",
    s?.currentBidTeamColor ?? "",
    s?.timerEndsAt ?? "",
    s?.remainingPlayersCount ?? "",
    input.displayIsBreak ? "1" : "0",
    input.breakEndsAt ?? "",
    input.breakMessage ?? "",
    input.outcomeKey ?? "",
    input.summarySold,
    input.summaryUnsold,
    input.summaryRemaining,
    input.summaryHighestBid,
    input.summaryTopBuyerName ?? "",
    input.summaryHighestTeamSpend,
    JSON.stringify(input.presentationContext ?? {}),
    JSON.stringify((input.soldPlayers ?? []).map((p) => `${p.id}:${p.soldPrice ?? 0}`)),
  ];
  return parts.join("|");
}

/** Auction-driven fields that should trigger a new BroadcastFrame. Excludes nowMs and animation ticks. */
export function computeDirectorSnapshotKey(
  ctx: DirectorContext,
  directorState: DirectorStateSnapshot,
): string {
  const parts = [
    ctx.outputTarget,
    ctx.tournamentId,
    directorState.sceneId,
    directorState.previousSceneId ?? "",
    directorState.isTransitioning ? "1" : "0",
    directorState.inEphemeralHold ? "1" : "0",
    directorState.ephemeralReturnSceneId ?? "",
    directorState.ephemeralHoldKey ?? ctx.outcomeKey ?? "",
    ctx.displayIsBreak ? "1" : "0",
    ctx.breakEndsAt ?? "",
    ctx.breakMessage ?? "",
    ctx.isStaleFeed ? "1" : "0",
    ctx.tournamentName ?? "",
    ctx.tournamentLogoUrl ?? "",
    ctx.settings.theme,
    ctx.settings.sponsorRotationSpeedSec,
    ctx.settings.obsPerformanceMode ? "1" : "0",
    JSON.stringify(
      directorState.bidTimeline.map((b) => `${b.id}:${b.amountLabel}`),
    ),
    JSON.stringify(
      ctx.sponsorLogos.map((s) => s.url ?? s.name ?? ""),
    ),
    ctx.summarySold,
    ctx.summaryUnsold,
    ctx.summaryRemaining,
    ctx.summaryHighestBid,
    ctx.summaryTopBuyerName ?? "",
    ctx.summaryHighestTeamSpend,
    JSON.stringify(ctx.presentationContext),
    JSON.stringify((ctx.soldPlayers ?? []).map((p) => `${p.id}:${p.soldPrice ?? 0}`)),
    JSON.stringify((ctx.teamPurses ?? []).map((t) => `${t.teamId}:${t.playersBought}:${t.spendablePurse}`)),
  ];
  return parts.join("|");
}

export function computeFrameContentKey(frame: {
  sceneId: string;
  scene: { kind: string };
  transition: { active: boolean; to: string };
}): string {
  return `${frame.sceneId}:${frame.scene.kind}:${frame.transition.active ? "t" : "f"}:${frame.transition.to}`;
}
