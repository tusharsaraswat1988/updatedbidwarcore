/**
 * Live-match slot for cricket competitions.
 *
 * Two draws may each have one live match. Two live matches in the same draw conflict.
 * A match with no fixture/draw lineage has no competition boundary, so it conflicts
 * with every other live cricket match in the tournament.
 */
export function cricketLiveSlotsConflict(
  candidateDrawId: number | null,
  otherDrawId: number | null,
): boolean {
  if (candidateDrawId == null || otherDrawId == null) return true;
  return candidateDrawId === otherDrawId;
}

/** Competition standings and progression require fixture → draw. */
export function hasCricketCompetitionLineage(fixture: { drawId: number | null } | null | undefined): boolean {
  return fixture?.drawId != null;
}
