import { parseBidTiers, type AuctionReadinessInput } from "./auction-readiness";
import { formatShortAuctionAmount, type AuctionUnit } from "./auction-unit";
import { isPlayerBidValueMode } from "./bid-value";

export type TeamReportAuctionRules = {
  minBid: number | null;
  auctionUnit: AuctionUnit;
  playersChooseBaseValue: boolean;
  categoryMinBids: Array<{ name: string; minBid: number }>;
  bidIncrementLines: string[];
  minimumSquadSize: number | null;
  maximumSquadSize: number | null;
};

export function describeBidIncrementRules(
  tournament: Pick<
    AuctionReadinessInput,
    | "bidTiers"
    | "bidTier1UpTo"
    | "bidTier1Increment"
    | "bidTier2UpTo"
    | "bidTier2Increment"
    | "bidTier3Increment"
  >,
  unit: AuctionUnit = "rupee",
): string[] {
  const tiers = parseBidTiers(tournament).filter((tier) => tier.increment > 0);
  if (tiers.length === 0) return [];

  if (tiers.length === 1 && tiers[0].upTo == null) {
    return [
      `Each bid must increase by ${formatShortAuctionAmount(tiers[0].increment, unit)} or more.`,
    ];
  }

  const lines: string[] = [];
  tiers.forEach((tier, index) => {
    const increment = formatShortAuctionAmount(tier.increment, unit);
    const isLast = index === tiers.length - 1;

    if (isLast && tier.upTo == null) {
      const previousUpTo = tiers[index - 1]?.upTo;
      if (previousUpTo != null && previousUpTo > 0) {
        lines.push(
          `Above ${formatShortAuctionAmount(previousUpTo, unit)}: raise by ${increment} or more.`,
        );
      } else {
        lines.push(`Each bid must increase by ${increment} or more.`);
      }
      return;
    }

    if (tier.upTo != null && tier.upTo > 0) {
      if (index === 0) {
        lines.push(`Up to ${formatShortAuctionAmount(tier.upTo, unit)}: raise by ${increment} or more.`);
      } else {
        const previousUpTo = tiers[index - 1]?.upTo ?? 0;
        lines.push(
          `Above ${formatShortAuctionAmount(previousUpTo, unit)} up to ${formatShortAuctionAmount(tier.upTo, unit)}: raise by ${increment} or more.`,
        );
      }
    }
  });

  return lines;
}

/** Empty auction working-sheet rows still needed after retained / pre-sold players. */
export function computeTeamReportPlanningRows(
  totalAcquired: number,
  minimumSquadSize: number,
  maximumSquadSize: number,
): { planningRows: number; slotsRemaining: number } {
  const slotsToReachMin = minimumSquadSize > 0
    ? Math.max(0, minimumSquadSize - totalAcquired)
    : 0;
  const slotsToReachMax = maximumSquadSize > 0
    ? Math.max(0, maximumSquadSize - totalAcquired)
    : 0;

  const planningRows = Math.max(
    slotsToReachMin,
    slotsToReachMax,
    slotsToReachMin === 0 && slotsToReachMax === 0 ? 8 : 0,
  );

  return {
    planningRows,
    slotsRemaining: slotsToReachMax > 0 ? slotsToReachMax : slotsToReachMin,
  };
}

export function buildTeamReportAuctionRules(input: {
  minBid: number;
  auctionUnit?: string | null;
  bidValueMode?: string | null;
  minimumSquadSize: number;
  maximumSquadSize: number;
  categories: Array<{ name: string; minBid: number | null }>;
  tournament: Pick<
    AuctionReadinessInput,
    | "bidTiers"
    | "bidTier1UpTo"
    | "bidTier1Increment"
    | "bidTier2UpTo"
    | "bidTier2Increment"
    | "bidTier3Increment"
  >;
}): TeamReportAuctionRules {
  const unit: AuctionUnit = input.auctionUnit === "points" ? "points" : "rupee";
  const minBid = input.minBid > 0 ? input.minBid : null;
  const categoryMinBids = input.categories
    .filter((category) => category.minBid != null && category.minBid > 0 && category.minBid !== input.minBid)
    .map((category) => ({ name: category.name, minBid: category.minBid! }));

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
