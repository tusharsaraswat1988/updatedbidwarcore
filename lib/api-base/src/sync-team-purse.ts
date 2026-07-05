export type TeamPurseSyncCandidate = {
  id: number;
  purse: number;
  purseUsed: number;
};

/**
 * Teams still on the previous tournament default budget (no spend, no custom purse).
 * When basePurse changes, only these rows should inherit the new default.
 */
export function teamIdsEligibleForBasePurseSync(
  teams: TeamPurseSyncCandidate[],
  previousBasePurse: number,
): number[] {
  return teams
    .filter((team) => team.purseUsed === 0 && team.purse === previousBasePurse)
    .map((team) => team.id);
}
