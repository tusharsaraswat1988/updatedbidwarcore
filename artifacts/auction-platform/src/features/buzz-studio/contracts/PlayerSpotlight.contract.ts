/**
 * Buzz Studio — Player Spotlight Contract
 *
 * Canonical data shape for the Player Spotlight template.
 *
 * Compatibility note:
 *   PlayerSpotlightData (templates/player-spotlight/PlayerSpotlight.types.ts)
 *   is structurally compatible with this contract — every field in
 *   PlayerSpotlightData satisfies the required fields here, and all
 *   additional contract fields (playerId, teamId, branding, metadata) are optional.
 *   No migration required for existing usages.
 *
 *   Use fromPlayerSpotlightData() in contract-mappers.ts for an explicit bridge.
 */

import type {
  ContractPlayerInfo,
  ContractTeamInfo,
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface PlayerSpotlightContract
  extends ContractPlayerInfo,
    ContractTeamInfo,
    ContractSportInfo {
  /**
   * Player role, position, or designation.
   * e.g. "Captain", "All Rounder", "Goalkeeper"
   */
  designation?: string;

  /**
   * Player's home city or state.
   * e.g. "Mumbai", "Varanasi"
   */
  city?: string;

  /** Branding overrides for this creative. */
  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
