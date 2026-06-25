/**
 * Buzz Studio — Tournament Launch Contract
 *
 * Data shape for the tournament launch announcement card.
 * Shown before the auction begins.
 */

import type {
  ContractSportInfo,
  ContractMetadata,
} from "./common";
import type { BuzzBranding } from "./branding";

export interface TournamentLaunchContract extends ContractSportInfo {
  /**
   * Source system tournament ID.
   * Optional — used for analytics or cache keys only.
   */
  tournamentId?: string;

  /**
   * Tournament display name.
   * Required. Primary headline of the card.
   * e.g. "Premier Cricket League 2026"
   */
  tournamentName: string;

  /**
   * Tournament edition or season label.
   * e.g. "Season 3", "2026 Edition"
   */
  edition?: string;

  /**
   * Human-readable start date string.
   * e.g. "15 July 2026" or "July 2026"
   */
  startDate?: string;

  /**
   * Human-readable end date string.
   */
  endDate?: string;

  /**
   * Venue name or city.
   * e.g. "DY Patil Stadium, Mumbai"
   */
  venue?: string;

  /**
   * Number of participating teams.
   * Used as a stat on the launch card.
   */
  teamsCount?: number;

  /**
   * Short tagline or subtitle for the tournament.
   * e.g. "The biggest cricket auction of the year"
   */
  tagline?: string;

  branding?: BuzzBranding;

  metadata?: ContractMetadata;
}
