export type MotmAwardInput = {
  id: number;
  matchId: number;
  awardType: string;
  reason: string | null;
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  shortCode: string;
};

export type MotmMatchInput = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  resultSummary: string | null;
  tournamentMatchNumber?: number | null;
};

export type MotmTeamInput = {
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string | null;
};

export type MotmAwardDetail = {
  id: number;
  matchId: number;
  reason: string | null;
  matchLabel: string;
};

export type MotmPlayerSummary = {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string | null;
  awards: MotmAwardDetail[];
};

function matchLabel(
  award: MotmAwardInput,
  match: MotmMatchInput | undefined,
  teams: Map<number, MotmTeamInput>,
): string {
  const numberPrefix =
    match?.tournamentMatchNumber != null ? `Match ${match.tournamentMatchNumber}` : null;
  const opponent =
    match == null
      ? null
      : match.homeTeamId === award.teamId
        ? teams.get(match.awayTeamId) ?? null
        : match.awayTeamId === award.teamId
          ? teams.get(match.homeTeamId) ?? null
          : null;
  const home = match ? teams.get(match.homeTeamId) : null;
  const away = match ? teams.get(match.awayTeamId) : null;
  const fixture =
    opponent?.teamName
      ? `vs ${opponent.teamName}`
      : home?.teamName && away?.teamName
        ? `${home.teamName} vs ${away.teamName}`
        : match?.resultSummary?.trim() || null;
  if (numberPrefix && fixture) return `${numberPrefix} · ${fixture}`;
  if (fixture) return fixture;
  if (numberPrefix) return numberPrefix;
  return `Match #${award.matchId}`;
}

/** One row per player, highest Man of the Match count first. */
export function summarizeManOfTheMatch(
  awards: MotmAwardInput[],
  matches: MotmMatchInput[],
  teams: MotmTeamInput[],
): MotmPlayerSummary[] {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const teamById = new Map(teams.map((team) => [team.teamId, team]));
  const byPlayer = new Map<number, MotmPlayerSummary>();

  for (const award of awards) {
    if (award.awardType !== "man_of_the_match") continue;
    const team = teamById.get(award.teamId);
    let row = byPlayer.get(award.playerId);
    if (!row) {
      row = {
        playerId: award.playerId,
        playerName: award.playerName,
        teamId: award.teamId,
        teamName: team?.teamName || award.teamName,
        shortCode: team?.shortCode || award.shortCode,
        color: team?.color ?? null,
        awards: [],
      };
      byPlayer.set(award.playerId, row);
    }
    row.awards.push({
      id: award.id,
      matchId: award.matchId,
      reason: award.reason,
      matchLabel: matchLabel(award, matchById.get(award.matchId), teamById),
    });
  }

  return [...byPlayer.values()].sort((a, b) => {
    if (b.awards.length !== a.awards.length) return b.awards.length - a.awards.length;
    return a.playerName.localeCompare(b.playerName);
  });
}
