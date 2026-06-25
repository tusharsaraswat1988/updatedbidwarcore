/**
 * Buzz Studio — Live Data Provider Types
 *
 * Shared snapshot model and data-source interface for mapping real
 * tournament data into Buzz Studio contracts.
 *
 * Providers accept a pluggable BuzzStudioLiveDataSource so the same
 * mappers work in the browser (API) and future server-side render jobs (DB).
 */

import {
  getTournament,
  listPlayers,
  listTeams,
  listBids,
} from "@workspace/api-client-react";
import type { Bid, Player, Team, Tournament } from "@workspace/api-client-react";
import { SportType } from "../types/sport-types";
import {
  brandingContextFromTournament,
  type BuzzStudioBrandingContext,
} from "./contract-branding";

export {
  buildContractBranding,
  brandingContextFromTournament,
  type BuzzStudioBrandingContext,
} from "./contract-branding";

/* ─── Snapshot ───────────────────────────────────────────────────────────── */

export interface BuzzStudioTournamentSnapshot extends BuzzStudioBrandingContext {
  tournamentId: number;
  sport: SportType;
  currency: string;
  players: Player[];
  teams: Team[];
  bids: Bid[];
}

/* ─── Data source ────────────────────────────────────────────────────────── */

export interface BuzzStudioLiveDataSource {
  loadSnapshot(tournamentId: number): Promise<BuzzStudioTournamentSnapshot>;
}

/* ─── Sport mapping ──────────────────────────────────────────────────────── */

const SPORT_MAP: Record<string, SportType> = {
  cricket: SportType.Cricket,
  badminton: SportType.Badminton,
  football: SportType.Football,
  volleyball: SportType.Volleyball,
  tennis: SportType.Tennis,
  kabaddi: SportType.Kabaddi,
};

export function toSportType(sport: string): SportType {
  return SPORT_MAP[sport.toLowerCase().trim()] ?? SportType.Cricket;
}

export function snapshotFromTournamentData(
  tournament: Tournament,
  players: Player[],
  teams: Team[],
  bids: Bid[],
): BuzzStudioTournamentSnapshot {
  return {
    tournamentId: tournament.id,
    ...brandingContextFromTournament(tournament),
    sport: toSportType(tournament.sport),
    currency: "INR",
    players,
    teams,
    bids,
  };
}

/* ─── Index helpers ──────────────────────────────────────────────────────── */

export function buildTeamById(teams: Team[]): Map<number, Team> {
  return new Map(teams.map((team) => [team.id, team]));
}

export function buildPlayerById(players: Player[]): Map<number, Player> {
  return new Map(players.map((player) => [player.id, player]));
}

export function buildBidCountByPlayer(bids: Bid[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const bid of bids) {
    counts.set(bid.playerId, (counts.get(bid.playerId) ?? 0) + 1);
  }
  return counts;
}

/* ─── Player / team field helpers ────────────────────────────────────────── */

const PLAYER_TAG_LABELS: Record<string, string> = {
  captain: "Captain",
  vice_captain: "Vice Captain",
  owner: "Owner",
  co_owner: "Co-Owner",
};

export function resolvePlayerDesignation(player: Player): string | undefined {
  if (player.playerTag) {
    return PLAYER_TAG_LABELS[player.playerTag] ?? player.playerTag.replace(/_/g, " ");
  }
  return player.role ?? undefined;
}

export function resolveTeamCaptain(
  teamId: number,
  players: Player[],
): Player | undefined {
  return players.find(
    (player) =>
      player.playerTag === "captain" &&
      (player.teamId === teamId || player.playerTagTeamId === teamId),
  );
}

export function countSquadPlayers(teamId: number, players: Player[]): number {
  return players.filter(
    (player) => player.teamId === teamId && !player.isNonPlayingMember,
  ).length;
}

export function optionalUrl(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function contractMetadata(tournamentId: number): {
  generatedAt: string;
  tags: Record<string, string>;
} {
  return {
    generatedAt: new Date().toISOString(),
    tags: { tournamentId: String(tournamentId) },
  };
}

/* ─── Default API data source ──────────────────────────────────────────────── */

export const apiBuzzStudioDataSource: BuzzStudioLiveDataSource = {
  async loadSnapshot(tournamentId) {
    const [tournament, players, teams, bids] = await Promise.all([
      getTournament(tournamentId),
      listPlayers(tournamentId),
      listTeams(tournamentId),
      listBids(tournamentId),
    ]);

    return snapshotFromTournamentData(tournament, players, teams, bids);
  },
};
