import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { and, inArray, isNull } from "drizzle-orm";
import {
  normalizeOrganizerContact,
  tournamentMatchesOrganizerContact,
} from "./claim-tournaments-match.js";

/**
 * Link unclaimed tournaments to an organizer account when contact fields match.
 * Only updates rows where organizer_id IS NULL (never steals from another account).
 */
export async function claimTournamentsForOrganizer(
  organizerId: number,
  contact: { mobile?: string | null; email?: string | null },
): Promise<number[]> {
  const normalized = normalizeOrganizerContact(contact);
  if (!normalized.mobileNorm && !normalized.emailNorm) return [];

  const unlinked = await db
    .select({
      id: tournamentsTable.id,
      organizerMobile: tournamentsTable.organizerMobile,
      organizerEmail: tournamentsTable.organizerEmail,
    })
    .from(tournamentsTable)
    .where(isNull(tournamentsTable.organizerId));

  const toClaim = unlinked
    .filter((row) => tournamentMatchesOrganizerContact(row, normalized))
    .map((row) => row.id);

  if (toClaim.length === 0) return [];

  await db
    .update(tournamentsTable)
    .set({ organizerId })
    .where(and(isNull(tournamentsTable.organizerId), inArray(tournamentsTable.id, toClaim)));

  return toClaim;
}
