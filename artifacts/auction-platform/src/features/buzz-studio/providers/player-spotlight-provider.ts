/**
 * Buzz Studio — Player Spotlight Live Data Provider
 *
 * Maps tournament players + teams into PlayerSpotlightContract[].
 */

import type { PlayerSpotlightContract } from "../contracts/PlayerSpotlight.contract";
import type { Player, Team } from "@workspace/api-client-react";
import {
  apiBuzzStudioDataSource,
  buildTeamById,
  contractMetadata,
  optionalUrl,
  resolvePlayerDesignation,
  type BuzzStudioLiveDataSource,
  type BuzzStudioTournamentSnapshot,
} from "./provider-types";

export function mapPlayerSpotlightFromSnapshot(
  snapshot: BuzzStudioTournamentSnapshot,
): PlayerSpotlightContract[] {
  const teamById = buildTeamById(snapshot.teams);
  const metadata = contractMetadata(snapshot.tournamentId);

  return snapshot.players
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((player) => mapPlayerToSpotlightContract(player, snapshot, teamById, metadata));
}

function mapPlayerToSpotlightContract(
  player: Player,
  snapshot: BuzzStudioTournamentSnapshot,
  teamById: Map<number, Team>,
  metadata: ReturnType<typeof contractMetadata>,
): PlayerSpotlightContract {
  const team = player.teamId != null ? teamById.get(player.teamId) : undefined;

  return {
    playerId: String(player.id),
    playerName: player.name,
    playerImageUrl: optionalUrl(player.photoUrl),
    teamId: team ? String(team.id) : undefined,
    teamName: team?.name,
    teamLogoUrl: optionalUrl(team?.logoUrl),
    sport: snapshot.sport,
    designation: resolvePlayerDesignation(player),
    city: optionalUrl(player.city),
    metadata,
  };
}

export async function getPlayerSpotlightContracts(
  tournamentId: number,
  source: BuzzStudioLiveDataSource = apiBuzzStudioDataSource,
): Promise<PlayerSpotlightContract[]> {
  const snapshot = await source.loadSnapshot(tournamentId);
  return mapPlayerSpotlightFromSnapshot(snapshot);
}
