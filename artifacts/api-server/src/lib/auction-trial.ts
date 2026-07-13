import type { Response } from "express";
import { asc, eq } from "drizzle-orm";
import { db, teamsTable } from "@workspace/db";
import {
  TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT,
  TRIAL_AUCTION_PARTICIPATION_ERROR,
  isAuctionLicenseActive,
} from "@workspace/api-base";

export { TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT, TRIAL_AUCTION_PARTICIPATION_ERROR, isAuctionLicenseActive };

/** First N team IDs (ascending) eligible to participate in a trial auction. */
export async function getTrialEligibleTeamIds(tournamentId: number): Promise<number[]> {
  const rows = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(asc(teamsTable.id))
    .limit(TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT);
  return rows.map((r) => r.id);
}

/**
 * Blocks bid / manual-sell for non-eligible teams when the tournament is not live-licensed.
 * Returns false after writing a 403 response.
 */
export async function assertTeamAllowedInTrialAuction(
  res: Response,
  tournament: { licenseStatus?: string | null } | null | undefined,
  tournamentId: number,
  teamId: number,
): Promise<boolean> {
  if (isAuctionLicenseActive(tournament?.licenseStatus)) return true;

  const eligibleIds = await getTrialEligibleTeamIds(tournamentId);
  if (!eligibleIds.includes(teamId)) {
    res.status(403).json({ error: TRIAL_AUCTION_PARTICIPATION_ERROR });
    return false;
  }
  return true;
}
