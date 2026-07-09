/**
 * Buzz Studio — Team Squad Contract
 *
 * Data shape for per-team squad roster creatives showing sold + retained players.
 */

import type {
  ContractTeamInfo,
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export type SquadPlayerStatus = "sold" | "retained";

export interface TeamSquadPlayerEntry {
  playerId?: string;
  playerName: string;
  playerImageUrl?: string;
  status: SquadPlayerStatus;
  /** Purchase or retention price (full unit). */
  price?: number;
  /** Pre-formatted price for display. */
  priceDisplay?: string;
  designation?: string;
  isCaptain?: boolean;
}

export interface TeamSquadContract extends ContractTeamInfo, ContractSportInfo {
  /** Ordered squad list — sold + retained playing members. */
  players: TeamSquadPlayerEntry[];

  /** Team accent color for roster chrome. */
  teamColor?: string;

  /**
   * Currency code.
   * @default "INR"
   */
  currency?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
