/** Parse API `createdAt` for deterministic dashboard ordering. */
export function organizerTournamentCreatedTimeMs(createdAt: string | undefined | null): number | null {
  if (createdAt == null || createdAt === "") return null;
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : null;
}

export type OrganizerTournamentSortable = {
  id: number;
  createdAt: string;
  status?: string;
  licenseStatus?: string;
};

export function isOrganizerTournamentCompleted(t: {
  status?: string;
  licenseStatus?: string;
}): boolean {
  return t.status === "completed" || t.licenseStatus === "completed";
}

/**
 * Organizer dashboard tournament sort:
 * 1. Active / non-completed tournaments come first, ordered newest first.
 * 2. Completed tournaments come last, ordered newest first (so oldest completed is at the very end).
 * Stable tie-break by id descending (newest id first).
 */
export function sortOrganizerTournaments<T extends OrganizerTournamentSortable>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const aCompleted = Boolean(a.status === "completed" || a.licenseStatus === "completed");
    const bCompleted = Boolean(b.status === "completed" || b.licenseStatus === "completed");

    // Active tournaments first, completed tournaments last
    if (!aCompleted && bCompleted) return -1;
    if (aCompleted && !bCompleted) return 1;

    // Within active or within completed: newest first (createdAt desc, tie-break id desc)
    const ta = organizerTournamentCreatedTimeMs(a.createdAt);
    const tb = organizerTournamentCreatedTimeMs(b.createdAt);
    if (ta === null && tb === null) return b.id - a.id;
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (ta !== tb) return tb - ta;
    return b.id - a.id;
  });
}

/**
 * Backward compatibility alias — organizer tournaments are sorted newest first with completed tournaments last.
 */
export const sortOrganizerTournamentsOldestFirst = sortOrganizerTournaments;
