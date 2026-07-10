/**
 * Buzz Studio — Top Buys Template Utilities
 *
 * Pure functions for formatting top-buy entry display values.
 * No React. No side effects.
 */

import type { TopBuyContract } from "./TopBuys.types";
import {
  formatBuzzPrice,
  resolveBuzzUnitFromContract,
} from "../../lib/format-buzz-price";

/**
 * Resolve the display price string for a TopBuyContract entry.
 *
 * Resolution order:
 *   1. `priceDisplay` — pre-formatted string (e.g. "₹42L")
 *   2. Format `price` using tournament auction unit (rupee → ₹, points → Pt.)
 *
 * @example
 * formatTopBuyPrice({ price: 500000, auctionUnit: "rupee" })
 * // → "₹5,00,000"
 *
 * formatTopBuyPrice({ price: 500000, auctionUnit: "points" })
 * // → "5,00,000 Pt."
 *
 * formatTopBuyPrice({ price: 4200000, priceDisplay: "₹42L" })
 * // → "₹42L"
 */
export function formatTopBuyPrice(entry: TopBuyContract): string {
  if (entry.priceDisplay) return entry.priceDisplay;
  const unit = resolveBuzzUnitFromContract(entry);
  return formatBuzzPrice(entry.price, unit);
}

/**
 * Resolve the effective rank for a TopBuyContract entry.
 * Uses entry.rank if present; falls back to the 1-based index in the list.
 *
 * @example
 * resolveRank({ rank: 2 }, 1) → 2
 * resolveRank({},           1) → 2  (index 1 → rank 2)
 */
export function resolveRank(entry: TopBuyContract, index: number): number {
  return entry.rank ?? index + 1;
}

/**
 * Compute the number of grid columns for the compact entries section.
 *
 *   1–4  items → 2 columns
 *   5–9  items → 3 columns
 *   10+  items → 3 columns (capped)
 */
export function compactGridCols(entryCount: number): number {
  if (entryCount <= 4) return 2;
  return 3;
}
