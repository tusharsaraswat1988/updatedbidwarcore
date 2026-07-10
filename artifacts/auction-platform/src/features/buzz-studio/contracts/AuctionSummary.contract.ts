/**
 * Buzz Studio — Auction Summary Contract
 *
 * Data shape for the auction summary / wrap-up card.
 * Aggregated statistics snapshot of a completed auction.
 */

import type {
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface AuctionSummaryContract extends ContractSportInfo {
  /**
   * Total number of players who entered the auction pool.
   */
  totalPlayers?: number;

  /**
   * Number of players successfully sold.
   */
  soldPlayers?: number;

  /**
   * Number of players who went unsold.
   */
  unsoldPlayers?: number;

  /**
   * Total amount spent across all teams (numeric, full unit).
   */
  totalSpend?: number;

  /**
   * Pre-formatted total spend string.
   * e.g. "₹12.4Cr" or "12.4L Pt."
   */
  totalSpendDisplay?: string;

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
   * Number of teams that participated in the auction.
   */
  teamsCount?: number;

  /**
   * Most expensive player name. Used for a highlight stat.
   */
  topBuyPlayerName?: string;

  /**
   * Highest single-player price (numeric, full unit).
   */
  topBuyPrice?: number;

  /**
   * Pre-formatted top buy price string.
   */
  topBuyPriceDisplay?: string;

  /**
   * Auction or tournament name shown in the card header.
   */
  tournamentName?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
