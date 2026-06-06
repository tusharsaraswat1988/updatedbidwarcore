import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, tournamentsTable, auctionSessionsTable } from "@workspace/db";
import { eq, or, sql, and, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { ownerLookupLimiter } from "../lib/rate-limiters";
import {
  normalizeOwnerMobile,
  ELIGIBLE_OWNER_LICENSE_STATUSES,
  rowToOwnerOnboardingEntry,
  sortOwnerOnboardingEntries,
} from "../lib/owner-onboarding";

const router = Router();

router.post("/owner/onboarding/lookup", ownerLookupLimiter, async (req, res) => {
  const body = z.object({
    mobile: z.string().trim().min(8).max(20),
  }).safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid mobile number" });
    return;
  }

  const mobile = body.data.mobile;
  const norm = normalizeOwnerMobile(mobile);

  const rows = await db
    .select({
      tournamentId: tournamentsTable.id,
      tournamentName: tournamentsTable.name,
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamShortCode: teamsTable.shortCode,
      teamColor: teamsTable.color,
      teamLogoUrl: teamsTable.logoUrl,
      licenseStatus: tournamentsTable.licenseStatus,
      tournamentStatus: tournamentsTable.status,
      auctionStatus: auctionSessionsTable.status,
      accessCode: teamsTable.accessCode,
    })
    .from(teamsTable)
    .innerJoin(tournamentsTable, eq(teamsTable.tournamentId, tournamentsTable.id))
    .leftJoin(auctionSessionsTable, eq(auctionSessionsTable.tournamentId, tournamentsTable.id))
    .where(and(
      or(
        eq(teamsTable.ownerMobile, mobile),
        eq(teamsTable.ownerMobile, norm),
        sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
      ),
      inArray(tournamentsTable.licenseStatus, [...ELIGIBLE_OWNER_LICENSE_STATUSES]),
      eq(tournamentsTable.adminLocked, false),
      ne(tournamentsTable.status, "completed"),
    ));

  const entries = sortOwnerOnboardingEntries(
    rows.map(rowToOwnerOnboardingEntry),
  );

  res.json({ entries });
});

export default router;
