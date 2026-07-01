import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import {
  formatLedAuctionAmount,
  formatLedAuctionAmountFull,
} from "@workspace/api-base/auction-unit";

export function formatINR(n: number, unit: AuctionUnit = "rupee"): string {
  return formatLedAuctionAmount(n, unit);
}

export function formatINRFull(n: number, unit: AuctionUnit = "rupee"): string {
  return formatLedAuctionAmountFull(n, unit);
}

export function nextIncrement(
  currentBid: number,
  tiers: { upTo: number; step: number }[],
  baseStep = 0,
  observedStep = 0,
): number {
  if (observedStep > 0) return observedStep;
  if (baseStep > 0) return baseStep;
  const tierStep =
    tiers.find((t) => currentBid < t.upTo)?.step ?? tiers[tiers.length - 1]?.step ?? 0;
  return tierStep > 0 ? tierStep : 10_000;
}
