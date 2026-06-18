/**
 * Buzz Studio — Sold Player Contract
 *
 * Data shape for the "SOLD" player card template.
 * Produced by the auction mapper after a player sale event.
 */

import type {
  ContractPlayerInfo,
  ContractTeamInfo,
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface SoldPlayerContract
  extends ContractPlayerInfo,
    ContractTeamInfo,
    ContractSportInfo {
  /**
   * Final hammer price (numeric, full unit — e.g. rupees, not paise).
   * Required. Displayed as the primary value in the template.
   */
  soldPrice: number;

  /**
   * ISO 4217 currency code or display symbol.
   * @default "INR"
   */
  currency?: string;

  /**
   * Pre-formatted price string for direct display.
   * When provided, overrides the template's own formatting of soldPrice.
   * e.g. "₹42,00,000" or "₹42L"
   */
  soldPriceDisplay?: string;

  /**
   * Total number of bids placed for this player.
   * Used as a secondary stat on the card.
   */
  bidCount?: number;

  /**
   * Player's role or position, shown beneath the name.
   * e.g. "Batsman", "Defender"
   */
  designation?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
