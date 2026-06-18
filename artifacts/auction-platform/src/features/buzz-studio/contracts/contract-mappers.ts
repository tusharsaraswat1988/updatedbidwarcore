/**
 * Buzz Studio — Contract Mappers
 *
 * Defines the integration boundary between upstream data sources
 * (auction DB models, API responses) and Buzz Studio contracts.
 *
 * ─── Phase 1 status ──────────────────────────────────────────────────────────
 *
 * All "from auction data" mappers are STUBS — signatures only, not implemented.
 * They throw NotImplementedError to make missing implementations visible at
 * runtime rather than silently producing empty cards.
 *
 * ─── Implementation plan ─────────────────────────────────────────────────────
 *
 *  Phase 6 — Auction Integration:
 *    Implement auction DB model → contract mappers.
 *    Each mapper receives a typed source object (not `unknown`).
 *
 * ─── Exception ───────────────────────────────────────────────────────────────
 *
 * fromPlayerSpotlightData() IS implemented — it is a zero-cost compatibility
 * bridge within Buzz Studio itself (not an auction integration boundary).
 * PlayerSpotlightData is structurally assignable to PlayerSpotlightContract
 * because the contract only adds optional fields not present in the legacy type.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { PlayerSpotlightContract } from "./PlayerSpotlight.contract";
import type { SoldPlayerContract } from "./SoldPlayer.contract";
import type { TopBuyContract, TopBuysListContract } from "./TopBuy.contract";
import type { TeamRevealContract } from "./TeamReveal.contract";
import type { AuctionSummaryContract } from "./AuctionSummary.contract";
import type { MvpCardContract } from "./MvpCard.contract";
import type { TournamentLaunchContract } from "./TournamentLaunch.contract";
import type { PlayerSpotlightData } from "../templates/player-spotlight/PlayerSpotlight.types";

/* ─── Error type ─────────────────────────────────────────────────────────── */

class NotImplementedError extends Error {
  constructor(mapperName: string) {
    super(
      `Contract mapper "${mapperName}" is not yet implemented. ` +
        `This will be implemented in Phase 6 — Auction Integration.`
    );
    this.name = "NotImplementedError";
  }
}

/* ─── Compatibility bridge (IMPLEMENTED) ────────────────────────────────── */

/**
 * Zero-cost bridge from the legacy PlayerSpotlightData type to the
 * canonical PlayerSpotlightContract.
 *
 * PlayerSpotlightData is structurally compatible with PlayerSpotlightContract:
 *   - All required fields (playerName, sport) are present in both
 *   - All extra contract fields (playerId, teamId, branding, metadata) are optional
 *
 * This function exists to make the boundary explicit in calling code.
 * It introduces no runtime transformation.
 *
 * @example
 * const contract = fromPlayerSpotlightData({ playerName: "Rahul Sharma", sport: SportType.Cricket });
 * // → { playerName: "Rahul Sharma", sport: "cricket" }
 */
export function fromPlayerSpotlightData(
  data: PlayerSpotlightData
): PlayerSpotlightContract {
  return data;
}

/* ─── Auction integration stubs (NOT IMPLEMENTED) ───────────────────────── */

/**
 * Maps an auction player record to a PlayerSpotlightContract.
 *
 * @param source - Raw player object from the auction data model.
 *                 Type will be narrowed in Phase 6.
 */
export function mapAuctionPlayerToSpotlightContract(
  source: unknown
): PlayerSpotlightContract {
  throw new NotImplementedError("mapAuctionPlayerToSpotlightContract");
}

/**
 * Maps an auction sale event to a SoldPlayerContract.
 *
 * @param source - Raw sale event / bid result from the auction system.
 */
export function mapAuctionPlayerToSoldPlayerContract(
  source: unknown
): SoldPlayerContract {
  throw new NotImplementedError("mapAuctionPlayerToSoldPlayerContract");
}

/**
 * Maps an auction sale record to a TopBuyContract.
 *
 * @param source - Raw sale record from the auction system.
 */
export function mapAuctionSaleToTopBuyContract(
  source: unknown
): TopBuyContract {
  throw new NotImplementedError("mapAuctionSaleToTopBuyContract");
}

/**
 * Maps an array of sale records to a TopBuysListContract.
 *
 * @param source - Array of top sale records (pre-sorted by price desc).
 */
export function mapAuctionSalesToTopBuysListContract(
  source: unknown
): TopBuysListContract {
  throw new NotImplementedError("mapAuctionSalesToTopBuysListContract");
}

/**
 * Maps a team record (post-auction) to a TeamRevealContract.
 *
 * @param source - Team entity with squad and budget data.
 */
export function mapAuctionTeamToRevealContract(
  source: unknown
): TeamRevealContract {
  throw new NotImplementedError("mapAuctionTeamToRevealContract");
}

/**
 * Maps an auction result aggregate to an AuctionSummaryContract.
 *
 * @param source - Auction summary/stats object from the API or DB.
 */
export function mapAuctionResultToSummaryContract(
  source: unknown
): AuctionSummaryContract {
  throw new NotImplementedError("mapAuctionResultToSummaryContract");
}

/**
 * Maps a player stats record to an MvpCardContract.
 *
 * @param source - Player with performance stats from scoring module.
 */
export function mapPlayerStatsToMvpCardContract(
  source: unknown
): MvpCardContract {
  throw new NotImplementedError("mapPlayerStatsToMvpCardContract");
}

/**
 * Maps a tournament record to a TournamentLaunchContract.
 *
 * @param source - Tournament entity from the DB or API.
 */
export function mapTournamentToLaunchContract(
  source: unknown
): TournamentLaunchContract {
  throw new NotImplementedError("mapTournamentToLaunchContract");
}
