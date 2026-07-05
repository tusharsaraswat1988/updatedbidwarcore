export type TeamPurseSyncCandidate = {
  id: number;
  purse: number;
  purseUsed: number;
};

function teamCanReceiveBasePurse(
  team: TeamPurseSyncCandidate,
  targetBasePurse: number,
): boolean {
  return targetBasePurse >= team.purseUsed;
}

/**
 * Teams still on the previous tournament default budget (custom overrides excluded).
 * When basePurse changes, these rows inherit the new default — including teams
 * that have already spent from the old default.
 */
export function teamIdsEligibleForBasePurseSync(
  teams: TeamPurseSyncCandidate[],
  previousBasePurse: number,
  targetBasePurse: number,
): number[] {
  return teams
    .filter(
      (team) =>
        team.purse === previousBasePurse &&
        teamCanReceiveBasePurse(team, targetBasePurse),
    )
    .map((team) => team.id);
}

/**
 * All teams share one purse below tournament.basePurse — indicates basePurse was
 * raised but team rows were never synced (e.g. after a live auction started).
 */
export function teamIdsEligibleForBasePurseDriftRepair(
  teams: TeamPurseSyncCandidate[],
  targetBasePurse: number,
): number[] {
  if (teams.length === 0) return [];

  const purses = new Set(teams.map((team) => team.purse));
  if (purses.size !== 1) return [];

  const [uniformPurse] = purses;
  if (uniformPurse >= targetBasePurse) return [];

  return teams
    .filter((team) => teamCanReceiveBasePurse(team, targetBasePurse))
    .map((team) => team.id);
}

/** Resolve every team row that should inherit tournament.basePurse. */
export function resolveTeamIdsForBasePurseUpdate(
  teams: TeamPurseSyncCandidate[],
  targetBasePurse: number,
  previousBasePurse?: number | null,
): number[] {
  const ids = new Set<number>();

  if (
    previousBasePurse != null &&
    targetBasePurse !== previousBasePurse
  ) {
    for (const id of teamIdsEligibleForBasePurseSync(
      teams,
      previousBasePurse,
      targetBasePurse,
    )) {
      ids.add(id);
    }
  }

  for (const id of teamIdsEligibleForBasePurseDriftRepair(teams, targetBasePurse)) {
    ids.add(id);
  }

  return [...ids];
}
