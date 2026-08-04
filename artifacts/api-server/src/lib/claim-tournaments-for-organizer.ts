import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import {
  normalizeOrganizerContact,
  tournamentMatchesOrganizerContact,
} from "./claim-tournaments-match.js";

export type ClaimTournamentsResult = {
  claimedIds: number[];
  skippedReason?: "no_contact" | "nothing_to_claim";
};

/**
 * Link unclaimed tournaments to an organizer account when contact fields match.
 * Idempotent: only updates rows where organizer_id IS NULL (never steals).
 * No-ops with no write when there is nothing to claim.
 */
export async function claimTournamentsForOrganizer(
  organizerId: number,
  contact: { mobile?: string | null; email?: string | null },
): Promise<number[]> {
  const result = await claimTournamentsForOrganizerDetailed(organizerId, contact);
  return result.claimedIds;
}

export async function claimTournamentsForOrganizerDetailed(
  organizerId: number,
  contact: { mobile?: string | null; email?: string | null },
): Promise<ClaimTournamentsResult> {
  const normalized = normalizeOrganizerContact(contact);
  if (!normalized.mobileNorm && !normalized.emailNorm) {
    logger.debug(
      { event: "SCORING_AUTH_CLAIM_SKIPPED", organizerId, reason: "no_contact" },
      "SCORING_AUTH_CLAIM_SKIPPED",
    );
    return { claimedIds: [], skippedReason: "no_contact" };
  }

  logger.debug(
    {
      event: "SCORING_AUTH_CLAIM_STARTED",
      organizerId,
      hasMobile: !!normalized.mobileNorm,
      hasEmail: !!normalized.emailNorm,
    },
    "SCORING_AUTH_CLAIM_STARTED",
  );

  try {
    // Prefilter unlinked rows that could match email or have a mobile to check.
    const emailClause = normalized.emailNorm
      ? sql`lower(trim(${tournamentsTable.organizerEmail})) = ${normalized.emailNorm}`
      : undefined;
    const mobileClause = normalized.mobileNorm
      ? sql`${tournamentsTable.organizerMobile} is not null and trim(${tournamentsTable.organizerMobile}) <> ''`
      : undefined;
    const contactClause =
      emailClause && mobileClause
        ? or(emailClause, mobileClause)
        : (emailClause ?? mobileClause);

    const unlinked = await db
      .select({
        id: tournamentsTable.id,
        organizerMobile: tournamentsTable.organizerMobile,
        organizerEmail: tournamentsTable.organizerEmail,
      })
      .from(tournamentsTable)
      .where(and(isNull(tournamentsTable.organizerId), contactClause));

    const toClaim = unlinked
      .filter((row) => tournamentMatchesOrganizerContact(row, normalized))
      .map((row) => row.id);

    if (toClaim.length === 0) {
      logger.debug(
        { event: "SCORING_AUTH_CLAIM_SKIPPED", organizerId, reason: "nothing_to_claim" },
        "SCORING_AUTH_CLAIM_SKIPPED",
      );
      return { claimedIds: [], skippedReason: "nothing_to_claim" };
    }

    // Idempotent write: re-check organizer_id IS NULL in UPDATE.
    await db
      .update(tournamentsTable)
      .set({ organizerId })
      .where(and(isNull(tournamentsTable.organizerId), inArray(tournamentsTable.id, toClaim)));

    logger.info(
      {
        event: "SCORING_AUTH_CLAIM_SUCCESS",
        organizerId,
        claimedIds: toClaim,
        count: toClaim.length,
      },
      "SCORING_AUTH_CLAIM_SUCCESS",
    );
    return { claimedIds: toClaim };
  } catch (err) {
    logger.error(
      { event: "SCORING_AUTH_CLAIM_FAILED", organizerId, err },
      "SCORING_AUTH_CLAIM_FAILED",
    );
    throw err;
  }
}

/**
 * Claim a single tournament for an organizer if unlinked and contact matches.
 * Idempotent: if already owned by this organizer, returns true without write.
 * Never steals from another organizer.
 */
export async function tryClaimTournamentForOrganizer(
  organizerId: number,
  tournamentId: number,
  contact: { mobile?: string | null; email?: string | null },
): Promise<"granted" | "already_owner" | "denied" | "not_found"> {
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      organizerId: tournamentsTable.organizerId,
      organizerMobile: tournamentsTable.organizerMobile,
      organizerEmail: tournamentsTable.organizerEmail,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) return "not_found";
  if (tournament.organizerId === organizerId) return "already_owner";
  if (tournament.organizerId != null) return "denied";

  const normalized = normalizeOrganizerContact(contact);
  if (!tournamentMatchesOrganizerContact(tournament, normalized)) {
    return "denied";
  }

  logger.debug(
    {
      event: "SCORING_AUTH_CLAIM_STARTED",
      organizerId,
      tournamentId,
      mode: "single",
    },
    "SCORING_AUTH_CLAIM_STARTED",
  );

  try {
    const updated = await db
      .update(tournamentsTable)
      .set({ organizerId })
      .where(
        and(
          eq(tournamentsTable.id, tournamentId),
          isNull(tournamentsTable.organizerId),
        ),
      )
      .returning({ id: tournamentsTable.id });

    if (updated.length === 0) {
      // Race: another account claimed first, or already linked.
      const [again] = await db
        .select({ organizerId: tournamentsTable.organizerId })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, tournamentId))
        .limit(1);
      if (again?.organizerId === organizerId) return "already_owner";
      logger.debug(
        {
          event: "SCORING_AUTH_CLAIM_SKIPPED",
          organizerId,
          tournamentId,
          reason: "race_or_taken",
        },
        "SCORING_AUTH_CLAIM_SKIPPED",
      );
      return "denied";
    }

    logger.info(
      {
        event: "SCORING_AUTH_CLAIM_SUCCESS",
        organizerId,
        claimedIds: [tournamentId],
        count: 1,
        mode: "single",
      },
      "SCORING_AUTH_CLAIM_SUCCESS",
    );
    return "granted";
  } catch (err) {
    logger.error(
      { event: "SCORING_AUTH_CLAIM_FAILED", organizerId, tournamentId, err },
      "SCORING_AUTH_CLAIM_FAILED",
    );
    throw err;
  }
}
