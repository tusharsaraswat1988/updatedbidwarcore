import type { BroadcastSceneId } from "../types";
import { themePalette } from "../tokens";
import { composeLayout, defaultWidgets } from "./layout-composer";
import {
  buildAllTeamOverviewModels,
  buildTeamOverviewModel,
  buildTop5Players,
  resolveCurrentContext,
} from "./context-resolver";
import type {
  BidTimelineItemModel,
  BroadcastAudioCue,
  BroadcastChromeModel,
  BroadcastFrame,
  BroadcastSceneModel,
  DirectorContext,
  DirectorTickResult,
  PlayerCardModel,
} from "./types";
import { BROADCAST_TRANSITION_MS } from "../tokens";

function buildPlayerModel(ctx: DirectorContext, accentColor: string): PlayerCardModel | null {
  if (!ctx.playerName) return null;
  return {
    name: ctx.playerName,
    photoUrl: ctx.playerPhotoUrl,
    photoSrc: ctx.resolvePhotoSrc(ctx.playerPhotoUrl, "playerCard"),
    category: ctx.currentCategoryName ?? ctx.playerRole,
    city: ctx.playerCity,
    basePriceLabel: ctx.formatAmount(ctx.playerBasePrice ?? 0),
    playerTag: ctx.playerTag,
    accentColor,
  };
}

function buildAuctionModel(ctx: DirectorContext, accent: string): BroadcastSceneModel {
  const hasBid = !!ctx.currentBidTeamName;
  const isActive = ctx.auctionStatus === "active";
  return {
    kind: "AUCTION",
    player: buildPlayerModel(ctx, accent),
    phase: isActive ? "live" : "up-next",
    bidLabel: hasBid ? "CURRENT BID" : "OPENING BID",
    bidAmountLabel: ctx.formatAmount(ctx.currentBid ?? ctx.playerBasePrice ?? 0),
    bidTeamName: ctx.currentBidTeamName,
    bidTeamLogoSrc: ctx.resolvePhotoSrc(ctx.currentBidTeamLogoUrl, "teamLogo"),
    bidColor: ctx.currentBidTeamColor ?? accent,
    timerEndsAt: isActive ? ctx.timerEndsAt : null,
    bidTimeline: [],
    remainingPoolLabel: ctx.remainingPlayersCount != null ? String(ctx.remainingPlayersCount) : "—",
    showBidPulse: isActive && hasBid,
  };
}

function buildSoldModel(ctx: DirectorContext, accent: string): BroadcastSceneModel {
  const teamColor = ctx.soldTeamColor ?? accent;
  return {
    kind: "SOLD",
    player: {
      name: ctx.soldPlayerName ?? "Player",
      photoUrl: ctx.soldPhotoUrl,
      photoSrc: ctx.resolvePhotoSrc(ctx.soldPhotoUrl, "soldCard"),
      category: null,
      city: null,
      basePriceLabel: "",
      playerTag: null,
      accentColor: teamColor,
    },
    soldPriceLabel: ctx.formatAmount(ctx.soldAmount ?? 0),
    soldAmount: ctx.soldAmount ?? 0,
    teamName: ctx.soldTeamName ?? "Team",
    teamColor,
    teamLogoSrc: ctx.resolvePhotoSrc(ctx.soldTeamLogoUrl, "teamLogo"),
  };
}

function buildUnsoldModel(ctx: DirectorContext): BroadcastSceneModel {
  return {
    kind: "UNSOLD",
    player: {
      name: ctx.unsoldPlayerName ?? "Player",
      photoUrl: ctx.unsoldPhotoUrl,
      photoSrc: ctx.resolvePhotoSrc(ctx.unsoldPhotoUrl, "soldCard"),
      category: null,
      city: null,
      basePriceLabel: "",
      playerTag: null,
      accentColor: "#ef4444",
    },
    reason: ctx.outcomeIsManual ? "Manual unsold" : null,
  };
}

function buildBreakModel(ctx: DirectorContext): BroadcastSceneModel {
  return {
    kind: "BREAK",
    breakEndsAt: ctx.breakEndsAt ?? new Date().toISOString(),
    breakMessage: ctx.breakMessage,
    sponsorNames: ctx.sponsorLogos.slice(0, 8).map((s) => s.name ?? s.type ?? "Sponsor"),
    websiteLabel: "bidwar.in",
    socialLabel: "@BidWarLive",
    showQr: true,
  };
}

function buildWaitingModel(ctx: DirectorContext): BroadcastSceneModel {
  return {
    kind: "WAITING",
    tournamentLogoSrc: ctx.resolvePhotoSrc(ctx.tournamentLogoUrl, "headerLogo"),
    countdownTargetIso: ctx.auctionStartsAt,
    standbyLabel: "STANDBY",
  };
}

function buildSummaryModel(ctx: DirectorContext): BroadcastSceneModel {
  const stats = [
    { label: "PLAYERS SOLD", value: String(ctx.summarySold) },
    { label: "REMAINING", value: String(ctx.summaryRemaining) },
    {
      label: "HIGHEST BID",
      value: ctx.summaryHighestBid > 0 ? ctx.formatAmount(ctx.summaryHighestBid) : "—",
    },
    { label: "TOP BUYER", value: ctx.summaryTopBuyerName ?? "—" },
    {
      label: "HIGHEST TEAM SPEND",
      value: ctx.summaryHighestTeamSpend > 0 ? ctx.formatAmount(ctx.summaryHighestTeamSpend) : "—",
    },
  ];
  if (ctx.summaryHighestTeamName) {
    stats.push({ label: "TOP SPENDER", value: ctx.summaryHighestTeamName });
  }
  return { kind: "SUMMARY", title: "TOURNAMENT SUMMARY", stats };
}

export function buildSceneModel(sceneId: BroadcastSceneId, ctx: DirectorContext, accent: string): BroadcastSceneModel {
  switch (sceneId) {
    case "SOLD":
      return buildSoldModel(ctx, accent);
    case "UNSOLD":
      return buildUnsoldModel(ctx);
    case "BREAK":
      return buildBreakModel(ctx);
    case "WAITING":
      return buildWaitingModel(ctx);
    case "SUMMARY":
      return buildSummaryModel(ctx);
    case "AUCTION":
    default:
      return buildAuctionModel(ctx, accent);
  }
}

export function buildChrome(ctx: DirectorContext, accent: string, sceneId: BroadcastSceneId): BroadcastChromeModel {
  return {
    tournamentName: ctx.tournamentName,
    tournamentLogoUrl: ctx.tournamentLogoUrl,
    sponsorLogos: ctx.sponsorLogos,
    sponsorRotationMs: ctx.settings.sponsorRotationSpeedSec * 1000,
    themeAccent: accent,
    showTopBar: sceneId === "AUCTION" || sceneId === "SUMMARY",
    showSponsorTicker: true,
    showConnectionBanner: true,
  };
}

export function collectPreloadUrls(scene: BroadcastSceneModel, chrome: BroadcastChromeModel): string[] {
  const urls: string[] = [];
  const push = (u: string | null | undefined) => {
    if (u) urls.push(u);
  };

  if (scene.kind === "AUCTION" && scene.player) push(scene.player.photoSrc);
  if (scene.kind === "SOLD") {
    push(scene.player.photoSrc);
    push(scene.teamLogoSrc);
  }
  if (scene.kind === "UNSOLD") push(scene.player.photoSrc);
  if (scene.kind === "WAITING") push(scene.tournamentLogoSrc);

  return urls;
}

export function assembleFrame(
  sceneId: BroadcastSceneId,
  previousSceneId: BroadcastSceneId | null,
  isTransitioning: boolean,
  ctx: DirectorContext,
  bidTimeline: BidTimelineItemModel[],
  audioCues: BroadcastAudioCue[],
  sceneHoldMs: number,
  returnSceneId: BroadcastSceneId | null,
  frameCounter: number,
): DirectorTickResult {
  const palette = themePalette(ctx.settings.theme);
  const layout = composeLayout(ctx.outputTarget);
  const sceneModel = buildSceneModel(sceneId, ctx, palette.accent);

  if (sceneModel.kind === "AUCTION") {
    sceneModel.bidTimeline = bidTimeline;
  }

  const chrome = buildChrome(ctx, palette.accent, sceneId);
  const currentContext = resolveCurrentContext(sceneId, ctx.presentationContext);
  const top5 =
    currentContext === "TOP5"
      ? {
          kind: "TOP5" as const,
          title: "Top 5 Highest Sold Players",
          players: buildTop5Players(ctx.soldPlayers, ctx.teamPurses, ctx.formatAmount, ctx.resolvePhotoSrc),
        }
      : null;
  const teamOverviews = buildAllTeamOverviewModels(ctx);
  const team =
    currentContext === "TEAM"
      ? buildTeamOverviewModel(ctx, ctx.presentationContext.selectedTeamId)
      : null;

  const frame: BroadcastFrame = {
    frameId: `${sceneId}-${frameCounter}`,
    sceneId,
    currentContext,
    outputTarget: ctx.outputTarget,
    transition: {
      from: previousSceneId,
      to: sceneId,
      active: isTransitioning,
      durationMs: BROADCAST_TRANSITION_MS,
    },
    layout,
    chrome,
    palette: { theme: ctx.settings.theme, ...palette },
    scene: sceneModel,
    top5,
    team,
    teamOverviews,
    widgets: defaultWidgets(sceneId),
    cameraFeeds: [
      {
        id: "main-camera",
        label: "Main Feed",
        sourceUrl: null,
        visible: false,
        rect: null,
      },
    ],
    preloadUrls: collectPreloadUrls(sceneModel, chrome),
    audioCues,
    obsPerformanceMode: ctx.isObsMode || ctx.settings.obsPerformanceMode,
    isStaleFeed: ctx.isStaleFeed,
    settings: ctx.settings,
  };

  return { frame, sceneHoldMs, sceneHoldDurationMs: 0, returnSceneId };
}
