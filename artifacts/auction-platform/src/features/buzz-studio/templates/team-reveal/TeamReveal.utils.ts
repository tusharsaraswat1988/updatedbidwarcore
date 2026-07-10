/**
 * Buzz Studio — Team Reveal Template Utilities
 *
 * Pure functions for formatting team reveal display values.
 * No React. No side effects.
 */

import type { TeamRevealContract } from "./TeamReveal.types";
import {
  formatBuzzPrice,
  resolveBuzzUnitFromContract,
} from "../../lib/format-buzz-price";

/**
 * Resolve the total spend display string for a TeamRevealContract.
 * Returns null when no spend data is present (hides the spend stat).
 *
 * Resolution order:
 *   1. `totalSpendDisplay` — pre-formatted string provided by the mapper
 *   2. Format `totalSpend` using tournament auction unit (rupee → ₹, points → Pt.)
 *   3. null — neither field present → caller should hide the stat
 *
 * @example
 * formatTeamSpend({ totalSpend: 32500000, auctionUnit: "rupee" })
 * // → "₹3,25,00,000"
 *
 * formatTeamSpend({ totalSpend: 32500000, auctionUnit: "points" })
 * // → "3,25,00,000 Pt."
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
  const unit = resolveBuzzUnitFromContract(contract);
  return formatBuzzPrice(contract.totalSpend, unit);
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
