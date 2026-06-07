import type { Player } from "@workspace/api-client-react";

/** Players eligible for a team's playing XI (sold or retained to that team). */
export function squadPlayersForTeam(players: Player[] | undefined, teamId: number): Player[] {
  if (!players) return [];
  return players.filter(
    (p) =>
      p.teamId === teamId &&
      (p.status === "sold" || p.status === "retained") &&
      !p.isNonPlayingMember,
  );
}

export function playerNameById(players: Player[] | undefined, id: number | null): string {
  if (!id || !players) return "—";
  return players.find((p) => p.id === id)?.name ?? `#${id}`;
}
