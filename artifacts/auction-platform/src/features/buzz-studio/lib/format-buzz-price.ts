/**
 * Buzz Studio — shared auction amount formatting
 *
 * All creative templates must use tournament.auctionUnit (rupee | points),
 * not a hardcoded INR / ₹ assumption.
 */

import {
  formatAuctionAmount,
  normalizeAuctionUnit,
  type AuctionUnit,
} from "@workspace/api-base/auction-unit";

export type { AuctionUnit };

/**
 * Resolve auction unit from contract fields.
 * Accepts `auctionUnit` ("rupee" | "points") or legacy `currency` ("INR" | "points").
 */
export function resolveBuzzAuctionUnit(
  value?: string | null,
): AuctionUnit {
  if (value === "points") return "points";
  if (value === "rupee" || value === "INR" || !value) return "rupee";
  return normalizeAuctionUnit(value);
}

/** Prefer explicit auctionUnit, then legacy currency code. */
export function resolveBuzzUnitFromContract(fields: {
  auctionUnit?: string | null;
  currency?: string | null;
}): AuctionUnit {
  if (fields.auctionUnit) return resolveBuzzAuctionUnit(fields.auctionUnit);
  return resolveBuzzAuctionUnit(fields.currency);
}

/**
 * Format a numeric auction amount for creative posters.
 * Points → "1,65,000 Pt."  |  Rupee → "₹1,65,000"
 */
export function formatBuzzPrice(
  amount: number | null | undefined,
  unit?: string | null,
): string {
  return formatAuctionAmount(amount, resolveBuzzAuctionUnit(unit));
}

/** Map auction unit into the legacy currency string some contracts still carry. */
export function currencyCodeForAuctionUnit(unit: AuctionUnit): string {
  return unit === "points" ? "points" : "INR";
}
