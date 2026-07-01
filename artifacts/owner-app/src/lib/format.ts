import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import {
  formatAuctionAmount,
  formatShortAuctionAmount,
} from "@workspace/api-base/auction-unit";

export type { AuctionUnit };

export function formatIndianRupee(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  return formatAuctionAmount(amount, unit);
}

export function formatShortIndianRupee(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  return formatShortAuctionAmount(amount, unit);
}

export { normalizeAuctionUnit as resolveAuctionUnit, auctionUnitSymbol } from "@workspace/api-base/auction-unit";
