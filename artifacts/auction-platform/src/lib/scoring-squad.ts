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
  name?: string | null;
  shortName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}): CricketScorerTeam {
  const safeName = t?.name?.trim() || `Team ${t?.auctionTeamId ?? ""}`.trim() || "Team";
  return {
    id: t?.auctionTeamId ?? 0,
    name: safeName,
    shortCode: t?.shortName?.trim() || safeName.slice(0, 3).toUpperCase() || "TM",
    color: t?.primaryColor ?? null,
    logoUrl: t?.logoUrl ?? null,
  };
}

export function cricketRosterToScorerPlayer(
  p: CricketTournamentRosterPlayer,
): CricketScorerPlayer {
  return {
    id: p?.auctionPlayerId ?? 0,
    name: p?.displayName?.trim() || "Player",
    teamId: p?.auctionTeamId ?? null,
    status: p?.status ?? "active",
    photoUrl: p?.photoUrl ?? null,
    role: p?.role ?? null,
    gender: null,
    isNonPlayingMember: false,
  };
}

/** Players eligible for a team's playing XI (active Player Registry roster). */
export function squadPlayersForTeam(
  players: CricketScorerPlayer[] | undefined,
  teamId: number,
): CricketScorerPlayer[] {
  if (!players || !Array.isArray(players)) return [];
  const excludedStatuses = new Set(["withdrawn", "unsold", "inactive", "disqualified"]);
  return players.filter(
    (p) =>
      p &&
      p.teamId === teamId &&
      !p.isNonPlayingMember &&
      (!p.status || !excludedStatuses.has(String(p.status).toLowerCase())),
  );
}

export function playerNameById(
  players: CricketScorerPlayer[] | undefined,
  id: number | null,
): string {
  if (!id || !players || !Array.isArray(players)) return "—";
  return players.find((p) => p && p.id === id)?.name ?? `#${id}`;
}
