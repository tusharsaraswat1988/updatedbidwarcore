import { parseBidTiers } from "./auction-readiness";
import { formatShortAuctionAmount } from "./auction-unit";
import { isPlayerBidValueMode } from "./bid-value";
export function describeBidIncrementRules(tournament, unit = "rupee", formatAmount = formatShortAuctionAmount) {
    const tiers = parseBidTiers(tournament).filter((tier) => tier.increment > 0);
    if (tiers.length === 0)
        return [];
    if (tiers.length === 1 && tiers[0].upTo == null) {
        return [
            `Each raise must be exactly ${formatAmount(tiers[0].increment, unit)}.`,
        ];
    }
    const lines = [];
    tiers.forEach((tier, index) => {
        const increment = formatAmount(tier.increment, unit);
        const isLast = index === tiers.length - 1;
        if (isLast && tier.upTo == null) {
            const previousUpTo = tiers[index - 1]?.upTo;
            if (previousUpTo != null && previousUpTo > 0) {
                lines.push(`Above ${formatAmount(previousUpTo, unit)}: each raise is exactly ${increment}.`);
            }
            else {
                lines.push(`Each raise must be exactly ${increment}.`);
            }
            return;
        }
        if (tier.upTo != null && tier.upTo > 0) {
            if (index === 0) {
                lines.push(`Up to ${formatAmount(tier.upTo, unit)}: each raise is exactly ${increment}.`);
            }
            else {
                const previousUpTo = tiers[index - 1]?.upTo ?? 0;
                lines.push(`Above ${formatAmount(previousUpTo, unit)} up to ${formatAmount(tier.upTo, unit)}: each raise is exactly ${increment}.`);
            }
        }
    });
    return lines;
}
/** Empty auction working-sheet rows still needed after retained / pre-sold players. */
export function computeTeamReportPlanningRows(totalAcquired, minimumSquadSize, maximumSquadSize) {
    const slotsToReachMin = minimumSquadSize > 0
        ? Math.max(0, minimumSquadSize - totalAcquired)
        : 0;
    const slotsToReachMax = maximumSquadSize > 0
        ? Math.max(0, maximumSquadSize - totalAcquired)
        : 0;
    const planningRows = Math.max(slotsToReachMin, slotsToReachMax, slotsToReachMin === 0 && slotsToReachMax === 0 ? 8 : 0);
    return {
        planningRows,
        slotsRemaining: slotsToReachMax > 0 ? slotsToReachMax : slotsToReachMin,
    };
}
export function buildTeamReportAuctionRules(input) {
    const unit = input.auctionUnit === "points" ? "points" : "rupee";
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
