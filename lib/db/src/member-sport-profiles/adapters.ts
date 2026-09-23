import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { memberIdentityLinksTable } from "../schema/member-identity-links";
import {
  memberSportProfilesTable,
  type MemberSportProfile,
} from "../schema/member-sport-profiles";

/**
 * Resolves the canonical MemberSportProfile for a legacy player record in a given sport.
 * Strictly respects Category A identity evidence (confidenceScore === 100).
 * Returns null for unlinked or Category B/C records without fabricating profiles.
 */
export async function resolveSportProfileForLegacyPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  params: {
    sourceTable: "players" | "global_players" | "badminton_players";
    sourceRecordId: number | string;
    sportSlug: string;
  },
): Promise<MemberSportProfile | null> {
  const [link] = await database
    .select()
    .from(memberIdentityLinksTable)
    .where(
      and(
        eq(memberIdentityLinksTable.sourceTable, params.sourceTable),
        eq(memberIdentityLinksTable.sourceRecordId, String(params.sourceRecordId)),
        eq(memberIdentityLinksTable.status, "active"),
      ),
    )
    .limit(1);

  // Category A only (confidenceScore = 100)
  if (!link || link.confidenceScore < 100) return null;

  const [profile] = await database
    .select()
    .from(memberSportProfilesTable)
    .where(
      and(
        eq(memberSportProfilesTable.memberId, link.memberId),
        eq(memberSportProfilesTable.sportSlug, params.sportSlug.trim().toLowerCase()),
      ),
    )
    .limit(1);

  return profile ?? null;
}
