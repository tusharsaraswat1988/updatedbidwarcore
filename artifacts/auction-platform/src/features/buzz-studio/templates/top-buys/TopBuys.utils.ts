/**
 * Buzz Studio — Top Buys Template Utilities
 *
 * Pure functions for formatting top-buy entry display values.
 * No React. No side effects. No auction imports.
 *
 * Price formatting algorithm: identical to formatSoldPrice() in
 * sold-player/SoldPlayer.utils.ts. Field names differ between contracts:
 *   TopBuyContract    → price, priceDisplay, currency
 *   SoldPlayerContract → soldPrice, soldPriceDisplay, currency
 *
 * The shared algorithm lives here rather than importing the sold-player
 * util directly to avoid cross-template coupling.
 */

import type { TopBuyContract } from "./TopBuys.types";

/* ─── Currency symbols ───────────────────────────────────────────────────── */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
};

/* ─── Indian number grouping ─────────────────────────────────────────────── */

/**
 * Format a number using Indian grouping (same logic as SoldPlayer.utils#formatINR).
 * 75000   → "₹75,000"
 * 500000  → "₹5,00,000"
 * 4200000 → "₹42,00,000"
 */
function formatINR(amount: number): string {
  const intStr = Math.round(amount).toString();
  if (intStr.length <= 3) return `₹${intStr}`;
  const lastThree = intStr.slice(-3);
  const remaining = intStr.slice(0, -3);
  const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${grouped},${lastThree}`;
}

function formatWithCurrency(amount: number, currency: string): string {
  if (currency === "INR") return formatINR(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

/* ─── Public helpers ─────────────────────────────────────────────────────── */

/**
 * Resolve the display price string for a TopBuyContract entry.
 *
 * Resolution order:
 *   1. `priceDisplay` — pre-formatted string (e.g. "₹42L")
 *   2. Format `price` using `currency` (defaults to "INR")
 *
 * @example
 * formatTopBuyPrice({ price: 500000 })
 * // → "₹5,00,000"
 *
 * formatTopBuyPrice({ price: 4200000, priceDisplay: "₹42L" })
 * // → "₹42L"
 */
export function formatTopBuyPrice(entry: TopBuyContract): string {
  if (entry.priceDisplay) return entry.priceDisplay;
  return formatWithCurrency(entry.price, entry.currency ?? "INR");
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
