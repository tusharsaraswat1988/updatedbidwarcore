import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import {
  formatAuctionAmount,
  formatAuctionAmountWords,
  formatShortAuctionAmount,
  formatSoldForBroadcast,
  parseAuctionAmountInput,
} from "@workspace/api-base/auction-unit";

export type { AuctionUnit };

export function formatIndianRupee(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  return formatAuctionAmount(amount, unit);
}

export function parseIndianAmountInput(raw: string | number | null | undefined): number {
  return parseAuctionAmountInput(raw);
}

export function formatIndianAmountWords(
  raw: string | number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  return formatAuctionAmountWords(raw, unit);
}

export function formatShortIndianRupee(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  return formatShortAuctionAmount(amount, unit);
}

export { formatSoldForBroadcast };

export {
  normalizeAuctionUnit,
  normalizeAuctionUnit as resolveAuctionUnit,
  auctionUnitSymbol,
  budgetFieldLabel,
  minValueFieldLabel,
  bidIncrementFieldLabel,
  AUCTION_UNIT_OPTIONS,
} from "@workspace/api-base/auction-unit";
