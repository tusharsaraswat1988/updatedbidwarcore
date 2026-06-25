/**
 * Buzz Studio — Team Reveal Template Utilities
 *
 * Pure functions for formatting team reveal display values.
 * No React. No side effects. No auction imports.
 */

import type { TeamRevealContract } from "./TeamReveal.types";

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
 * Resolve the total spend display string for a TeamRevealContract.
 * Returns null when no spend data is present (hides the spend stat).
 *
 * Resolution order:
 *   1. `totalSpendDisplay` — pre-formatted string provided by the mapper
 *   2. Format `totalSpend` using `currency` (defaults to "INR")
 *   3. null — neither field present → caller should hide the stat
 *
 * @example
 * formatTeamSpend({ totalSpend: 32500000 })
 * // → "₹3,25,00,000"
 *
 * formatTeamSpend({ totalSpend: 32500000, totalSpendDisplay: "₹3.25Cr" })
 * // → "₹3.25Cr"
 *
 * formatTeamSpend({})
 * // → null
 */
export function formatTeamSpend(contract: TeamRevealContract): string | null {
  if (contract.totalSpendDisplay) return contract.totalSpendDisplay;
  if (contract.totalSpend == null) return null;
  return formatWithCurrency(contract.totalSpend, contract.currency ?? "INR");
}

/**
 * Format squad size as a human-readable label.
 *
 * @example
 * formatPlayerCount(1)  → "1 Player"
 * formatPlayerCount(15) → "15 Players"
 */
export function formatPlayerCount(count: number): string {
  return count === 1 ? "1 Player" : `${count} Players`;
}
