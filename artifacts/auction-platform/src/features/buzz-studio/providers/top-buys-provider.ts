/**
 * Buzz Studio — Top Buys Live Data Provider
 *
 * Maps the top 10 sold players (by soldPrice desc) into TopBuysListContract.
 */

import type { TopBuyContract, TopBuysListContract } from "../contracts/TopBuy.contract";
import type { Player, Team } from "@workspace/api-client-react";
import {
  apiBuzzStudioDataSource,
  buildTeamById,
  buildContractBranding,
  contractMetadata,
  optionalUrl,
  resolvePlayerDesignation,
  type BuzzStudioLiveDataSource,
  type BuzzStudioTournamentSnapshot,
} from "./provider-types";

const TOP_BUYS_LIMIT = 10;

export function mapTopBuysFromSnapshot(
  snapshot: BuzzStudioTournamentSnapshot,
): TopBuysListContract {
  const teamById = buildTeamById(snapshot.teams);
  const metadata = contractMetadata(snapshot.tournamentId);
  const branding = buildContractBranding(snapshot);

  const topSold = snapshot.players
    .filter((player) => player.status === "sold" && player.soldPrice != null)
    .toSorted((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
    .slice(0, TOP_BUYS_LIMIT);

  const entries = topSold.map((player, index) =>
    mapTopBuyEntry(player, snapshot, teamById, index + 1, metadata, branding),
  );

  return {
    sport: snapshot.sport,
    entries,
    title: entries.length > 0 ? `Top ${entries.length} Buys` : "Top Buys",
    branding,
    metadata,
  };
}

function mapTopBuyEntry(
  player: Player,
  snapshot: BuzzStudioTournamentSnapshot,
  teamById: Map<number, Team>,
  rank: number,
  metadata: ReturnType<typeof contractMetadata>,
  branding: ReturnType<typeof buildContractBranding>,
): TopBuyContract {
  const team = player.teamId != null ? teamById.get(player.teamId) : undefined;

  return {
    playerId: String(player.id),
    playerName: player.name,
    playerImageUrl: optionalUrl(player.photoUrl),
    teamId: team ? String(team.id) : undefined,
    teamName: team?.name,
    teamLogoUrl: optionalUrl(team?.logoUrl),
    sport: snapshot.sport,
    price: player.soldPrice!,
    auctionUnit: snapshot.auctionUnit,
    currency: snapshot.currency,
    rank,
    designation: resolvePlayerDesignation(player),
    branding,
    metadata,
  };
}

export async function getTopBuysContract(
  tournamentId: number,
  source: BuzzStudioLiveDataSource = apiBuzzStudioDataSource,
): Promise<TopBuysListContract> {
  const snapshot = await source.loadSnapshot(tournamentId);
  return mapTopBuysFromSnapshot(snapshot);
}
