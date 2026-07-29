export type TeamGroupInput = {
  teamId: number;
  teamName: string;
  registrationIds: number[];
};

export type PlannedLeagueFixture = {
  slotNumber: number;
  registrationAId: number;
  registrationBId: number;
  roundLabel: string;
  metaJson: {
    algorithm: "team_tie";
    groupName: string;
    teamAId: number;
    teamBId: number;
    rubberIndex: number;
  };
};

/**
 * VNBL-style team tie fixtures: for each team pair in a group, pair[k] vs pair[k].
 * Requires at least 2 teams with matching pair counts (uses min pair count).
 */
export function planTeamTieGroupFixtures(
  groupName: string,
  teams: TeamGroupInput[],
): PlannedLeagueFixture[] {
  if (teams.length < 2) return [];

  const fixtures: PlannedLeagueFixture[] = [];
  let slotNumber = 1;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i]!;
      const teamB = teams[j]!;
      const rubbers = Math.min(teamA.registrationIds.length, teamB.registrationIds.length);

      for (let r = 0; r < rubbers; r++) {
        const regA = teamA.registrationIds[r];
        const regB = teamB.registrationIds[r];
        if (regA == null || regB == null) continue;

        fixtures.push({
          slotNumber: slotNumber++,
          registrationAId: regA,
          registrationBId: regB,
          roundLabel: `${groupName} — ${teamA.teamName} vs ${teamB.teamName} (Rubber ${r + 1})`,
          metaJson: {
            algorithm: "team_tie",
            groupName,
            teamAId: teamA.teamId,
            teamBId: teamB.teamId,
            rubberIndex: r + 1,
          },
        });
      }
    }
  }

  return fixtures;
}

/** Circle-method round robin for pair registrations within one group. */
export function planPairRoundRobinFixtures(
  groupName: string,
  registrationIds: number[],
): PlannedLeagueFixture[] {
  if (registrationIds.length < 2) return [];

  const ids = [...registrationIds];
  const isOdd = ids.length % 2 === 1;
  if (isOdd) ids.push(-1);

  const n = ids.length;
  const rotation = [...ids];
  const fixtures: PlannedLeagueFixture[] = [];
  let slotNumber = 1;

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i]!;
      const b = rotation[n - 1 - i]!;
      if (a === -1 || b === -1) continue;

      fixtures.push({
        slotNumber: slotNumber++,
        registrationAId: a,
        registrationBId: b,
        roundLabel: `${groupName} — Round ${round + 1}`,
        metaJson: {
          algorithm: "pair_round_robin" as const,
          groupName,
          teamAId: 0,
          teamBId: 0,
          rubberIndex: round + 1,
        },
      });
    }
    const fixed = rotation[0]!;
    const rest = rotation.slice(1);
    const last = rest.pop()!;
    rotation.splice(0, rotation.length, fixed, last, ...rest);
  }

  return fixtures;
}
