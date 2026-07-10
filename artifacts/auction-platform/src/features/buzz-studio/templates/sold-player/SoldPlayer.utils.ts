/**
 * Buzz Studio — Sold Player Template Utilities
 *
 * Pure functions for formatting sold card display values.
 * No React. No side effects.
 */

import type { SoldPlayerContract } from "./SoldPlayer.types";
import {
  formatBuzzPrice,
  resolveBuzzUnitFromContract,
} from "../../lib/format-buzz-price";

/**
 * Resolve the display price string for a SoldPlayerContract.
 *
 * Resolution order:
 *   1. `soldPriceDisplay` — pre-formatted string provided by the mapper
 *   2. Format `soldPrice` using tournament auction unit (rupee → ₹, points → Pt.)
 *
 * @example
 * formatSoldPrice({ soldPrice: 75000, auctionUnit: "rupee" })
 * // → "₹75,000"
 *
 * formatSoldPrice({ soldPrice: 75000, auctionUnit: "points" })
 * // → "75,000 Pt."
 *
 * formatSoldPrice({ soldPrice: 4200000, soldPriceDisplay: "₹42L" })
 * // → "₹42L"
 */
export function formatSoldPrice(contract: SoldPlayerContract): string {
  if (contract.soldPriceDisplay) return contract.soldPriceDisplay;
  const unit = resolveBuzzUnitFromContract(contract);
  return formatBuzzPrice(contract.soldPrice, unit);
}

/**
 * Format bid count as a human-readable label.
 *
 * @example
 * formatBidCount(1)  → "1 Bid"
 * formatBidCount(12) → "12 Bids"
 * formatBidCount(0)  → "0 Bids"
 */
export function formatBidCount(count: number): string {
  return count === 1 ? "1 Bid" : `${count} Bids`;
}
