/**
 * Buzz Studio — Team Reveal Live Data Provider
 *
 * Maps tournament teams into TeamRevealContract[] with captain, squad size, and spend.
 */

import type { TeamRevealContract } from "../contracts/TeamReveal.contract";
import type { Team } from "@workspace/api-client-react";
import {
  apiBuzzStudioDataSource,
  contractMetadata,
  countSquadPlayers,
  optionalUrl,
  resolveTeamCaptain,
  type BuzzStudioLiveDataSource,
  type BuzzStudioTournamentSnapshot,
} from "./provider-types";

export function mapTeamRevealFromSnapshot(
  snapshot: BuzzStudioTournamentSnapshot,
): TeamRevealContract[] {
  const metadata = contractMetadata(snapshot.tournamentId);

  return snapshot.teams
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((team) => mapTeamRevealContract(team, snapshot, metadata));
}

function mapTeamRevealContract(
  team: Team,
  snapshot: BuzzStudioTournamentSnapshot,
  metadata: ReturnType<typeof contractMetadata>,
): TeamRevealContract {
  const captain = resolveTeamCaptain(team.id, snapshot.players);
  const playerCount = countSquadPlayers(team.id, snapshot.players);
  const totalSpend = team.purseUsed > 0 ? team.purseUsed : undefined;

  return {
    teamId: String(team.id),
    teamName: team.name,
    teamLogoUrl: optionalUrl(team.logoUrl),
    sport: snapshot.sport,
    captainName: captain?.name,
    captainImageUrl: optionalUrl(captain?.photoUrl),
    playerCount: playerCount > 0 ? playerCount : undefined,
    totalSpend,
    currency: snapshot.currency,
    metadata,
  };
}

export async function getTeamRevealContracts(
  tournamentId: number,
  source: BuzzStudioLiveDataSource = apiBuzzStudioDataSource,
): Promise<TeamRevealContract[]> {
  const snapshot = await source.loadSnapshot(tournamentId);
  return mapTeamRevealFromSnapshot(snapshot);
}
