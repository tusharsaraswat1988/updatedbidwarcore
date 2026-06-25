/**
 * Buzz Studio — Team Reveal Contract
 *
 * Data shape for the team reveal card.
 * Shows a team's identity, captain, and squad size post-auction.
 */

import type {
  ContractTeamInfo,
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface TeamRevealContract extends ContractTeamInfo, ContractSportInfo {
  /**
   * Captain's display name.
   * Triggers CaptainBadge rendering in the template.
   */
  captainName?: string;

  /**
   * Captain's image URL.
   * Falls back to monogram via the design system if absent.
   */
  captainImageUrl?: string;

  /**
   * Total number of players in the squad.
   * Shown as a stat on the card.
   */
  playerCount?: number;

  /**
   * Total spend on squad (numeric, full unit).
   * Optional — shown as a secondary stat if provided.
   */
  totalSpend?: number;

  /**
   * Pre-formatted total spend string.
   * e.g. "₹3.2Cr"
   */
  totalSpendDisplay?: string;

  /**
   * Currency code.
   * @default "INR"
   */
  currency?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
