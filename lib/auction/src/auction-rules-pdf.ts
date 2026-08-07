/**
 * Gate + content helpers for the organizer "Download auction rules" PDF.
 * Unlock does not require teams/players — only identity + core auction rule fields.
 */

import { parseBidTiers, type AuctionReadinessInput } from "./auction-readiness";
import { MIN_AUCTION_TIMER_SECONDS } from "./auction-timer";
import {
  formatShortAuctionAmount,
  normalizeAuctionUnit,
  type AuctionUnit,
} from "./auction-unit";
import { describeBidIncrementRules, buildTeamReportAuctionRules } from "./team-report-rules";
import { isPlayerBidValueMode } from "./bid-value";

export type AuctionRulesPdfGateInput = {
  name?: string | null;
  city?: string | null;
  basePurse?: number | null;
  minBid?: number | null;
  timerSeconds?: number | null;
  bidTimerSeconds?: number | null;
  minimumSquadSize?: number | null;
  bidTiers?: string | null;
  bidTier1UpTo?: number | null;
  bidTier1Increment?: number | null;
  bidTier2UpTo?: number | null;
  bidTier2Increment?: number | null;
  bidTier3Increment?: number | null;
};

export type AuctionRulesPdfGateResult = {
  ready: boolean;
  blockedReason: string | null;
};

const PLAYER_MODE_LABELS: Record<string, string> = {
  sequential: "In order — players come up one by one as added",
  random: "Random draw",
  manual: "Manual — operator picks from the queue list",
};

export function evaluateAuctionRulesPdfReady(
  input: AuctionRulesPdfGateInput,
): AuctionRulesPdfGateResult {
  if (!(input.name ?? "").trim()) {
    return { ready: false, blockedReason: "Add a tournament name before downloading." };
  }
  if (!(input.city ?? "").trim()) {
    return { ready: false, blockedReason: "Add a city before downloading." };
  }
  if (!input.basePurse || input.basePurse <= 0) {
    return { ready: false, blockedReason: "Set team budget in Auction Rules before downloading." };
  }
  if (!input.minBid || input.minBid <= 0) {
    return { ready: false, blockedReason: "Set minimum player value in Auction Rules before downloading." };
  }

  const tiers = parseBidTiers({
    bidTiers: input.bidTiers,
    bidTier1UpTo: input.bidTier1UpTo ?? undefined,
    bidTier1Increment: input.bidTier1Increment ?? undefined,
    bidTier2UpTo: input.bidTier2UpTo ?? undefined,
    bidTier2Increment: input.bidTier2Increment ?? undefined,
    bidTier3Increment: input.bidTier3Increment ?? undefined,
  });
  if (tiers.length === 0 || !tiers.some((t) => t.increment > 0)) {
    return { ready: false, blockedReason: "Configure bid increment rules before downloading." };
  }

  if ((input.timerSeconds ?? 0) < MIN_AUCTION_TIMER_SECONDS) {
    return {
      ready: false,
      blockedReason: `Set opening timer (min ${MIN_AUCTION_TIMER_SECONDS}s) before downloading.`,
    };
  }
  if ((input.bidTimerSeconds ?? 0) < MIN_AUCTION_TIMER_SECONDS) {
    return {
      ready: false,
      blockedReason: `Set bid timer (min ${MIN_AUCTION_TIMER_SECONDS}s) before downloading.`,
    };
  }
  if (!input.minimumSquadSize || input.minimumSquadSize <= 0) {
    return { ready: false, blockedReason: "Set minimum players per team before downloading." };
  }

  return { ready: true, blockedReason: null };
}

export type AuctionRulesPdfCategoryInput = {
  name: string;
  minBid: number | null;
  bidIncrement: number | null;
  bidTiers: string | null;
};

export type AuctionRulesPdfCategoryOverride = {
  name: string;
  lines: string[];
};

export type AuctionRulesPdfDocumentModel = {
  tournamentName: string;
  sport: string;
  city: string | null;
  venue: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  auctionUnit: AuctionUnit;
  basePurse: number;
  minBid: number;
  bidIncrementLines: string[];
  playersChooseBaseValue: boolean;
  timerSeconds: number;
  bidTimerSeconds: number;
  bidExtensionEnabled: boolean;
  bidExtensionThresholdSeconds: number;
  bidExtensionSeconds: number;
  playerSelectionModeLabel: string;
  minimumSquadSize: number;
  maximumSquadSize: number | null;
  categoryOverrides: AuctionRulesPdfCategoryOverride[];
};

function categoryIncrementLines(
  category: AuctionRulesPdfCategoryInput,
  unit: AuctionUnit,
): string[] {
  if (category.bidTiers) {
    return describeBidIncrementRules({ bidTiers: category.bidTiers }, unit);
  }
  if (category.bidIncrement != null && category.bidIncrement > 0) {
    return [
      `Each bid must increase by ${formatShortAuctionAmount(category.bidIncrement, unit)} or more.`,
    ];
  }
  return [];
}

export function buildAuctionRulesPdfCategoryOverrides(
  tournamentMinBid: number,
  unit: AuctionUnit,
  categories: AuctionRulesPdfCategoryInput[],
): AuctionRulesPdfCategoryOverride[] {
  const overrides: AuctionRulesPdfCategoryOverride[] = [];

  for (const category of categories) {
    const lines: string[] = [];
    if (category.minBid != null && category.minBid > 0 && category.minBid !== tournamentMinBid) {
      lines.push(`Minimum player value: ${formatShortAuctionAmount(category.minBid, unit)}`);
    }
    lines.push(...categoryIncrementLines(category, unit));
    if (lines.length > 0) {
      overrides.push({ name: category.name, lines });
    }
  }

  return overrides;
}

export function playerSelectionModeLabel(mode: string | null | undefined): string {
  const key = (mode ?? "").trim();
  return PLAYER_MODE_LABELS[key] ?? (key || "Random draw");
}

export function buildAuctionRulesPdfDocumentModel(input: {
  name: string;
  sport: string;
  city?: string | null;
  venue?: string | null;
  auctionDate?: string | null;
  auctionTime?: string | null;
  auctionUnit?: string | null;
  basePurse: number;
  minBid: number;
  bidValueMode?: string | null;
  timerSeconds: number;
  bidTimerSeconds: number;
  bidExtensionEnabled?: boolean | null;
  bidExtensionThresholdSeconds?: number | null;
  bidExtensionSeconds?: number | null;
  playerSelectionMode?: string | null;
  minimumSquadSize: number;
  maximumSquadSize?: number | null;
  categories: AuctionRulesPdfCategoryInput[];
  tournament: Pick<
    AuctionReadinessInput,
    | "bidTiers"
    | "bidTier1UpTo"
    | "bidTier1Increment"
    | "bidTier2UpTo"
    | "bidTier2Increment"
    | "bidTier3Increment"
  >;
}): AuctionRulesPdfDocumentModel {
  const unit = normalizeAuctionUnit(input.auctionUnit);
  const reportRules = buildTeamReportAuctionRules({
    minBid: input.minBid,
    auctionUnit: unit,
    bidValueMode: input.bidValueMode,
    minimumSquadSize: input.minimumSquadSize,
    maximumSquadSize: input.maximumSquadSize ?? 0,
    categories: input.categories.map((c) => ({ name: c.name, minBid: c.minBid })),
    tournament: input.tournament,
  });

  return {
    tournamentName: input.name.trim(),
    sport: input.sport,
    city: input.city?.trim() || null,
    venue: input.venue?.trim() || null,
    auctionDate: input.auctionDate ?? null,
    auctionTime: input.auctionTime ?? null,
    auctionUnit: unit,
    basePurse: input.basePurse,
    minBid: input.minBid,
    bidIncrementLines: reportRules.bidIncrementLines,
    playersChooseBaseValue: isPlayerBidValueMode({ bidValueMode: input.bidValueMode }),
    timerSeconds: input.timerSeconds,
    bidTimerSeconds: input.bidTimerSeconds,
    bidExtensionEnabled: !!input.bidExtensionEnabled,
    bidExtensionThresholdSeconds: input.bidExtensionThresholdSeconds ?? 3,
    bidExtensionSeconds: input.bidExtensionSeconds ?? 5,
    playerSelectionModeLabel: playerSelectionModeLabel(input.playerSelectionMode),
    minimumSquadSize: input.minimumSquadSize,
    maximumSquadSize:
      input.maximumSquadSize != null && input.maximumSquadSize > 0
        ? input.maximumSquadSize
        : null,
    categoryOverrides: buildAuctionRulesPdfCategoryOverrides(
      input.minBid,
      unit,
      input.categories,
    ),
  };
}
