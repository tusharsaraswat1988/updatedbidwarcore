/**
 * Buzz Studio — Top Buy Contract
 *
 * Data shape for a single entry in a "Top Buys" card or list.
 * Represents the most expensive player purchase in a given auction or tournament.
 */

import type {
  ContractPlayerInfo,
  ContractTeamInfo,
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface TopBuyContract
  extends ContractPlayerInfo,
    ContractTeamInfo,
    ContractSportInfo {
  /**
   * Purchase price for this player (full numeric unit).
   */
  price: number;

  /**
   * Pre-formatted price string for direct display.
   * e.g. "₹42L", "1.2L Pt."
   */
  priceDisplay?: string;

  /**
   * Tournament auction unit — "rupee" | "points".
   * Prefer this over `currency` for display formatting.
   * @default "rupee"
   */
  auctionUnit?: string;

  /**
   * Legacy currency code ("INR" | "points"). Prefer `auctionUnit`.
   * @default "INR"
   */
  currency?: string;

  /**
   * Position in the top-N ranking list.
   * 1 = highest buy. Used for rank badge rendering.
   */
  rank?: number;

  /**
   * Player's role or position.
   */
  designation?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}

/**
 * Contract for a "Top Buys" summary card showing multiple entries.
 */
export interface TopBuysListContract extends ContractSportInfo {
  /** Ordered list (by price desc) of top buy entries. */
  entries: TopBuyContract[];

  /** Card headline. e.g. "Top 3 Buys" */
  title?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
