/**
 * Buzz Studio — Sold Player Template Utilities
 *
 * Pure functions for formatting sold card display values.
 * No React. No side effects. No auction imports.
 */

import type { SoldPlayerContract } from "./SoldPlayer.types";

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
 * Format a number in Indian grouping convention.
 * 75000     → "₹75,000"
 * 100000    → "₹1,00,000"
 * 500000    → "₹5,00,000"
 * 4200000   → "₹42,00,000"
 *
 * Indian system: last 3 digits stay as a group, then groups of 2 from right.
 */
function formatINR(amount: number): string {
  const intStr = Math.round(amount).toString();
  if (intStr.length <= 3) return `₹${intStr}`;
  const lastThree = intStr.slice(-3);
  const remaining = intStr.slice(0, -3);
  // Groups of 2 after the last-3 block (Indian grouping)
  const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${grouped},${lastThree}`;
}

/**
 * Format a price amount using the given currency code.
 * For INR, uses Indian number grouping.
 * For all others, uses standard en-US comma separation.
 */
function formatWithCurrency(amount: number, currency: string): string {
  if (currency === "INR") return formatINR(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

/* ─── Public helpers ─────────────────────────────────────────────────────── */

/**
 * Resolve the display price string for a SoldPlayerContract.
 *
 * Resolution order:
 *   1. `soldPriceDisplay` — pre-formatted string provided by the mapper
 *   2. Format `soldPrice` using `currency` (defaults to "INR")
 *
 * @example
 * formatSoldPrice({ soldPrice: 75000 })
 * // → "₹75,000"
 *
 * formatSoldPrice({ soldPrice: 4200000, soldPriceDisplay: "₹42L" })
 * // → "₹42L"
 *
 * formatSoldPrice({ soldPrice: 500, currency: "USD" })
 * // → "$500"
 */
export function formatSoldPrice(contract: SoldPlayerContract): string {
  if (contract.soldPriceDisplay) return contract.soldPriceDisplay;
  return formatWithCurrency(contract.soldPrice, contract.currency ?? "INR");
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
