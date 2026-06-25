/**
 * Buzz Studio — MVP Card Contract
 *
 * Data shape for the Most Valuable Player card.
 * Used for end-of-auction or end-of-tournament MVP announcements.
 */

import type {
  ContractPlayerInfo,
  ContractTeamInfo,
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface MvpCardContract
  extends ContractPlayerInfo,
    ContractTeamInfo,
    ContractSportInfo {
  /**
   * Achievement headline.
   * e.g. "Most Valuable Player", "Top Scorer", "Golden Glove"
   */
  achievementTitle?: string;

  /**
   * Flexible stat record for displaying player-specific metrics.
   * Keys are stat labels, values are display values.
   *
   * @example
   * { "Matches": 12, "Runs": 480, "Average": "40.0" }
   * { "Goals": 8, "Assists": 5, "Clean Sheets": 3 }
   */
  stats?: Record<string, string | number>;

  /**
   * Player's role or position.
   * e.g. "Batsman", "Goalkeeper", "Raider"
   */
  designation?: string;

  /**
   * Player's city or state.
   */
  city?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
