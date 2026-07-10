/**
 * Buzz Studio — Sold Player Live Data Provider
 *
 * Maps auction sold players into SoldPlayerContract[].
 */

import type { SoldPlayerContract } from "../contracts/SoldPlayer.contract";
import type { Player, Team } from "@workspace/api-client-react";
import {
  apiBuzzStudioDataSource,
  buildBidCountByPlayer,
  buildTeamById,
  buildContractBranding,
  contractMetadata,
  optionalUrl,
  resolvePlayerDesignation,
  type BuzzStudioLiveDataSource,
  type BuzzStudioTournamentSnapshot,
} from "./provider-types";

export function mapSoldPlayersFromSnapshot(
  snapshot: BuzzStudioTournamentSnapshot,
): SoldPlayerContract[] {
  const teamById = buildTeamById(snapshot.teams);
  const bidCountByPlayer = buildBidCountByPlayer(snapshot.bids);
  const metadata = contractMetadata(snapshot.tournamentId);
  const branding = buildContractBranding(snapshot);

  return snapshot.players
    .filter((player) => player.status === "sold" && player.soldPrice != null)
    .toSorted((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
    .map((player) =>
      mapSoldPlayerContract(player, snapshot, teamById, bidCountByPlayer, metadata, branding),
    );
}

function mapSoldPlayerContract(
  player: Player,
  snapshot: BuzzStudioTournamentSnapshot,
  teamById: Map<number, Team>,
  bidCountByPlayer: Map<number, number>,
  metadata: ReturnType<typeof contractMetadata>,
  branding: ReturnType<typeof buildContractBranding>,
): SoldPlayerContract {
  const team = player.teamId != null ? teamById.get(player.teamId) : undefined;
  const bidCount = bidCountByPlayer.get(player.id);

  return {
    playerId: String(player.id),
    playerName: player.name,
    playerImageUrl: optionalUrl(player.photoUrl),
    teamId: team ? String(team.id) : undefined,
    teamName: team?.name,
    teamLogoUrl: optionalUrl(team?.logoUrl),
    sport: snapshot.sport,
    soldPrice: player.soldPrice!,
    auctionUnit: snapshot.auctionUnit,
    currency: snapshot.currency,
    bidCount: bidCount && bidCount > 0 ? bidCount : undefined,
    designation: resolvePlayerDesignation(player),
    branding,
    metadata,
  };
}

export async function getSoldPlayerContracts(
  tournamentId: number,
  source: BuzzStudioLiveDataSource = apiBuzzStudioDataSource,
): Promise<SoldPlayerContract[]> {
  const snapshot = await source.loadSnapshot(tournamentId);
  return mapSoldPlayersFromSnapshot(snapshot);
}
