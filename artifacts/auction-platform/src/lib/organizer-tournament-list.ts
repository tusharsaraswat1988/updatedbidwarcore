/** Parse API `createdAt` for deterministic dashboard ordering. */
export function organizerTournamentCreatedTimeMs(createdAt: string | undefined | null): number | null {
  if (createdAt == null || createdAt === "") return null;
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : null;
}

export type OrganizerTournamentSortable = {
  id: number;
  createdAt: string;
};

/** Default dashboard order: oldest created first; stable tie-break by id ascending. */
export function sortOrganizerTournamentsOldestFirst<T extends OrganizerTournamentSortable>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta = organizerTournamentCreatedTimeMs(a.createdAt);
    const tb = organizerTournamentCreatedTimeMs(b.createdAt);
    if (ta === null && tb === null) return a.id - b.id;
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (ta !== tb) return ta - tb;
    return a.id - b.id;
  });
}
