import type { CricketTournamentRosterPlayer } from "@/lib/scoring-api";

/** Minimal team shape for cricket scorer UI (opaque franchise team id). */
export type CricketScorerTeam = {
  id: number;
  name: string;
  shortCode: string;
  color: string | null;
  logoUrl: string | null;
};

/** Minimal player shape for cricket scorer UI (opaque franchise player id). */
export type CricketScorerPlayer = {
  id: number;
  name: string;
  teamId: number | null;
  status: string;
  photoUrl: string | null;
  role: string | null;
  gender: string | null;
  isNonPlayingMember: boolean;
};

export function cricketMasterTeamToScorerTeam(t: {
  auctionTeamId: number;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}): CricketScorerTeam {
  return {
    id: t.auctionTeamId,
    name: t.name,
    shortCode: t.shortName?.trim() || t.name.slice(0, 3).toUpperCase(),
    color: t.primaryColor,
    logoUrl: t.logoUrl,
  };
}

export function cricketRosterToScorerPlayer(
  p: CricketTournamentRosterPlayer,
): CricketScorerPlayer {
  return {
    id: p.auctionPlayerId,
    name: p.displayName,
    teamId: p.auctionTeamId,
    status: p.status,
    photoUrl: p.photoUrl,
    role: p.role,
    gender: null,
    isNonPlayingMember: false,
  };
}

/** Players eligible for a team's playing XI (active Player Registry roster). */
export function squadPlayersForTeam(
  players: CricketScorerPlayer[] | undefined,
  teamId: number,
): CricketScorerPlayer[] {
  if (!players) return [];
  return players.filter(
    (p) =>
      p.teamId === teamId &&
      !p.isNonPlayingMember &&
      (p.status === "sold" ||
        p.status === "retained" ||
        p.status === "transfer" ||
        p.status === "unsold_replacement" ||
        p.status === "interchange" ||
        p.status === "auction_sale"),
  );
}

export function playerNameById(
  players: CricketScorerPlayer[] | undefined,
  id: number | null,
): string {
  if (!id || !players) return "—";
  return players.find((p) => p.id === id)?.name ?? `#${id}`;
}
