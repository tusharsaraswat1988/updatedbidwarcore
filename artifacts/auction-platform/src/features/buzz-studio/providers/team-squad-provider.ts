/**
 * Buzz Studio — Team Squad Live Data Provider
 *
 * Maps tournament teams into TeamSquadContract[] with sold + retained players.
 */

import type { TeamSquadContract, TeamSquadPlayerEntry } from "../contracts/TeamSquad.contract";
import type { Player, Team } from "@workspace/api-client-react";
import {
  apiBuzzStudioDataSource,
  buildContractBranding,
  contractMetadata,
  optionalUrl,
  resolvePlayerDesignation,
  type BuzzStudioLiveDataSource,
  type BuzzStudioTournamentSnapshot,
} from "./provider-types";

const TOP_SOLD_LIMIT = 5;

function squadPrice(player: Player): number | undefined {
  if (player.status === "retained") {
    return player.retainedPrice ?? player.soldPrice ?? undefined;
  }
  return player.soldPrice ?? undefined;
}

/** Tournament-wide top sold player ids → rank (1 = highest). */
function topSoldRankByPlayerId(
  players: Player[],
  limit = TOP_SOLD_LIMIT,
): Map<string, number> {
  const ranked = players
    .filter((player) => player.status === "sold" && (player.soldPrice ?? 0) > 0)
    .toSorted((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
    .slice(0, limit);

  const map = new Map<string, number>();
  ranked.forEach((player, index) => {
    map.set(String(player.id), index + 1);
  });
  return map;
}

function mapSquadPlayer(
  player: Player,
  topSoldRanks: Map<string, number>,
): TeamSquadPlayerEntry {
  const price = squadPrice(player);
  const playerId = String(player.id);
  const topSoldRank = topSoldRanks.get(playerId);
  return {
    playerId,
    playerName: player.name,
    playerImageUrl: optionalUrl(player.photoUrl),
    status: player.status === "retained" ? "retained" : "sold",
    price,
    designation: resolvePlayerDesignation(player),
    isCaptain: player.playerTag === "captain",
    playerTag: player.playerTag ?? undefined,
    isTopSold: topSoldRank != null,
    topSoldRank,
  };
}

function sortSquadPlayers(players: TeamSquadPlayerEntry[]): TeamSquadPlayerEntry[] {
  return players.toSorted((a, b) => {
    if (a.isCaptain && !b.isCaptain) return -1;
    if (!a.isCaptain && b.isCaptain) return 1;
    if (a.status === "retained" && b.status !== "retained") return -1;
    if (a.status !== "retained" && b.status === "retained") return 1;
    return (b.price ?? 0) - (a.price ?? 0);
  });
}

export function mapTeamSquadFromSnapshot(
  snapshot: BuzzStudioTournamentSnapshot,
): TeamSquadContract[] {
  const metadata = contractMetadata(snapshot.tournamentId);
  const branding = buildContractBranding(snapshot);
  const topSoldRanks = topSoldRankByPlayerId(snapshot.players);

  return snapshot.teams
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((team) => mapTeamSquadContract(team, snapshot, metadata, branding, topSoldRanks));
}

function mapTeamSquadContract(
  team: Team,
  snapshot: BuzzStudioTournamentSnapshot,
  metadata: ReturnType<typeof contractMetadata>,
  branding: ReturnType<typeof buildContractBranding>,
  topSoldRanks: Map<string, number>,
): TeamSquadContract {
  const squadPlayers = snapshot.players
    .filter(
      (player) =>
        player.teamId === team.id &&
        !player.isNonPlayingMember &&
        (player.status === "sold" || player.status === "retained"),
    )
    .map((player) => mapSquadPlayer(player, topSoldRanks));

  return {
    teamId: String(team.id),
    teamName: team.name,
    teamLogoUrl: optionalUrl(team.logoUrl),
    teamColor: team.color ?? undefined,
    sport: snapshot.sport,
    players: sortSquadPlayers(squadPlayers),
    currency: snapshot.currency,
    branding,
    metadata,
  };
}

export async function getTeamSquadContracts(
  tournamentId: number,
  source: BuzzStudioLiveDataSource = apiBuzzStudioDataSource,
): Promise<TeamSquadContract[]> {
  const snapshot = await source.loadSnapshot(tournamentId);
  return mapTeamSquadFromSnapshot(snapshot);
}
