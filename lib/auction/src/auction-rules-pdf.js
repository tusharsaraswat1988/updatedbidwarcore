/**
 * Gate + content helpers for the organizer "Download auction rules" PDF.
 * Unlock does not require teams/players — only identity + core auction rule fields.
 */
import { parseAuctionDateString } from "./auction-date";
import { parseBidTiers } from "./auction-readiness";
import { MIN_AUCTION_TIMER_SECONDS } from "./auction-timer";
import { formatPdfSafeAuctionAmount, normalizeAuctionUnit } from "./auction-unit";
import { describeBidIncrementRules } from "./team-report-rules";
import { getOrganizerBidOptions, isPlayerBidValueMode } from "./bid-value";

const PLAYER_MODE_LABELS = {
    sequential: "In order - players come up one by one as added",
    random: "Random draw",
    manual: "Manual - operator picks from the queue list",
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
export function formatSportLabel(sport) {
    const trimmed = (sport ?? "").trim();
    if (!trimmed)
        return "";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
const PDF_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatAuctionDateForPdf(date) {
    const trimmed = date?.trim();
    if (!trimmed)
        return null;
    const parsed = parseAuctionDateString(trimmed);
    if (!parsed)
        return trimmed;
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = PDF_MONTHS[parsed.getMonth()] ?? "";
    return `${day} ${month} ${parsed.getFullYear()}`;
}
export function formatAuctionTimeForPdf(time) {
    const trimmed = time?.trim();
    if (!trimmed)
        return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
    if (!match)
        return trimmed;
    const hours = Number(match[1]);
    const minutes = match[2];
    if (!Number.isFinite(hours) || hours < 0 || hours > 23)
        return trimmed;
    const suffix = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes} ${suffix}`;
}
function categoryIncrementLines(category, unit) {
    if (category.bidTiers) {
        return describeBidIncrementRules({ bidTiers: category.bidTiers }, unit, formatPdfSafeAuctionAmount);
    }
    if (category.bidIncrement != null && category.bidIncrement > 0) {
        return [
            `Each raise must be exactly ${formatPdfSafeAuctionAmount(category.bidIncrement, unit)}.`,
        ];
    }
    return [];
}
export function buildAuctionRulesPdfCategoryOverrides(tournamentMinBid, unit, categories) {
    const overrides = [];
    for (const category of categories) {
        const lines = [];
        if (category.minBid != null && category.minBid > 0 && category.minBid !== tournamentMinBid) {
            lines.push(`Minimum player value: ${formatPdfSafeAuctionAmount(category.minBid, unit)}`);
        }
        lines.push(...categoryIncrementLines(category, unit));
        if (category.maxPlayers != null && category.maxPlayers > 0) {
            lines.push(`Maximum players per team: ${category.maxPlayers}`);
        }
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
    const playersChooseBaseValue = isPlayerBidValueMode({ bidValueMode: input.bidValueMode });
    const allowedValues = playersChooseBaseValue
        ? getOrganizerBidOptions({ bidValueOptions: input.bidValueOptions })
        : [];
    return {
        tournamentName: input.name.trim(),
        sport: formatSportLabel(input.sport),
        organizerName: input.organizerName?.trim() || null,
        city: input.city?.trim() || null,
        venue: input.venue?.trim() || null,
        auctionDate: formatAuctionDateForPdf(input.auctionDate),
        auctionTime: formatAuctionTimeForPdf(input.auctionTime),
        auctionUnit: unit,
        auctionUnitLabel: unit === "points" ? "Points (Pt.)" : "Rupee (Rs.)",
        basePurseLabel: formatPdfSafeAuctionAmount(input.basePurse, unit),
        minBidLabel: formatPdfSafeAuctionAmount(input.minBid, unit),
        bidIncrementLines: describeBidIncrementRules(input.tournament, unit, formatPdfSafeAuctionAmount),
        openingBidNote: "The first bid on a player must match that player's minimum value exactly. Later raises must match the increment in force at that price - not a larger jump.",
        playersChooseBaseValue,
        allowedBaseValuesLabel: allowedValues.length > 0
            ? allowedValues.map((value) => formatPdfSafeAuctionAmount(value, unit)).join(", ")
            : null,
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
        squadReserveNote: input.minimumSquadSize > 0
            ? `Until a team reaches ${input.minimumSquadSize} players, the system reserves ${formatPdfSafeAuctionAmount(input.minBid, unit)} for each empty slot. That reserved amount cannot be spent on a more expensive player.`
            : null,
        categoryOverrides: buildAuctionRulesPdfCategoryOverrides(input.minBid, unit, input.categories),
    };
}
