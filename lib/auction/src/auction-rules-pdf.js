/**
 * Gate + content helpers for the organizer "Download auction rules" PDF.
 * Unlock does not require teams/players — only identity + core auction rule fields.
 */
import { parseBidTiers } from "./auction-readiness";
import { MIN_AUCTION_TIMER_SECONDS } from "./auction-timer";
import { formatShortAuctionAmount, normalizeAuctionUnit, } from "./auction-unit";
import { describeBidIncrementRules, buildTeamReportAuctionRules } from "./team-report-rules";
import { isPlayerBidValueMode } from "./bid-value";
const PLAYER_MODE_LABELS = {
    sequential: "In order — players come up one by one as added",
    random: "Random draw",
    manual: "Manual — operator picks from the queue list",
};
export function evaluateAuctionRulesPdfReady(input) {
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
function categoryIncrementLines(category, unit) {
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
export function buildAuctionRulesPdfCategoryOverrides(tournamentMinBid, unit, categories) {
    const overrides = [];
    for (const category of categories) {
        const lines = [];
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
export function playerSelectionModeLabel(mode) {
    const key = (mode ?? "").trim();
    return PLAYER_MODE_LABELS[key] ?? (key || "Random draw");
}
export function buildAuctionRulesPdfDocumentModel(input) {
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
        maximumSquadSize: input.maximumSquadSize != null && input.maximumSquadSize > 0
            ? input.maximumSquadSize
            : null,
        categoryOverrides: buildAuctionRulesPdfCategoryOverrides(input.minBid, unit, input.categories),
    };
}
