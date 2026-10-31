import { parseBidTiers } from "./auction-readiness";
import { formatShortAuctionAmount, normalizeAuctionUnit } from "./auction-unit";
import { isPlayerBidValueMode } from "./bid-value";
function terminateSentence(str) {
    const trimmed = str.trim();
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}
export function describeBidIncrementRules(tournament, unit = "points", formatAmount = formatShortAuctionAmount) {
    const tiers = parseBidTiers(tournament).filter((tier) => tier.increment > 0);
    if (tiers.length === 0)
        return [];
    if (tiers.length === 1 && tiers[0].upTo == null) {
        return [
            terminateSentence(`Each raise must be exactly ${formatAmount(tiers[0].increment, unit)}`),
        ];
    }
    const lines = [];
    tiers.forEach((tier, index) => {
        const increment = formatAmount(tier.increment, unit);
        const isLast = index === tiers.length - 1;
        if (isLast && tier.upTo == null) {
            const previousUpTo = tiers[index - 1]?.upTo;
            if (previousUpTo != null && previousUpTo > 0) {
                lines.push(terminateSentence(`Above ${formatAmount(previousUpTo, unit)}: each raise is exactly ${increment}`));
            }
            else {
                lines.push(terminateSentence(`Each raise must be exactly ${increment}`));
            }
            return;
        }
        if (tier.upTo != null && tier.upTo > 0) {
            if (index === 0) {
                lines.push(terminateSentence(`Up to ${formatAmount(tier.upTo, unit)}: each raise is exactly ${increment}`));
            }
            else {
                const previousUpTo = tiers[index - 1]?.upTo ?? 0;
                lines.push(terminateSentence(`Above ${formatAmount(previousUpTo, unit)} up to ${formatAmount(tier.upTo, unit)}: each raise is exactly ${increment}`));
            }
        }
    });
    return lines;
}
/** Empty auction working-sheet rows still needed after retained / pre-sold players. */
export function computeTeamReportPlanningRows(totalAcquired, minimumSquadSize, maximumSquadSize) {
    const hasSquadTargets = minimumSquadSize > 0 || maximumSquadSize > 0;
    const slotsToReachMin = minimumSquadSize > 0
        ? Math.max(0, minimumSquadSize - totalAcquired)
        : 0;
    const slotsToReachMax = maximumSquadSize > 0
        ? Math.max(0, maximumSquadSize - totalAcquired)
        : 0;
    let planningRows;
    if (hasSquadTargets) {
        planningRows = Math.max(slotsToReachMin, slotsToReachMax);
    }
    else {
        // When no squad size is configured: if no players acquired yet, provide 8 blank worksheet rows.
        // If players have already been acquired, no mandatory blank rows are needed.
        planningRows = totalAcquired === 0 ? 8 : 0;
    }
    return {
        planningRows,
        slotsRemaining: slotsToReachMax > 0 ? slotsToReachMax : slotsToReachMin,
    };
}
export function buildTeamReportAuctionRules(input) {
    const unit = normalizeAuctionUnit(input.auctionUnit);
    const minBid = input.minBid > 0 ? input.minBid : null;
    const categoryMinBids = input.categories
        .filter((category) => category.minBid != null && category.minBid > 0 && category.minBid !== input.minBid)
        .map((category) => ({ name: category.name, minBid: category.minBid }));
    return {
        minBid,
        auctionUnit: unit,
        playersChooseBaseValue: isPlayerBidValueMode({ bidValueMode: input.bidValueMode }),
        categoryMinBids,
        bidIncrementLines: describeBidIncrementRules(input.tournament, unit),
        minimumSquadSize: input.minimumSquadSize > 0 ? input.minimumSquadSize : null,
        maximumSquadSize: input.maximumSquadSize > 0 ? input.maximumSquadSize : null,
    };
}
