import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { membersTable, type Member } from "../schema/members";
import { memberIdentityLinksTable } from "../schema/member-identity-links";
import { tournamentParticipationsTable } from "../schema/tournament-participations";

/**
 * Resolves the canonical Member identity for a legacy Organizer ID.
 * Returns Member if a confident, active link exists; otherwise null.
 */
export async function resolveMemberForLegacyOrganizer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  organizerId: number,
): Promise<Member | null> {
  const [link] = await database
    .select()
    .from(memberIdentityLinksTable)
    .where(
      and(
        eq(memberIdentityLinksTable.sourceTable, "organizers"),
        eq(memberIdentityLinksTable.sourceRecordId, String(organizerId)),
        eq(memberIdentityLinksTable.status, "active"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, link.memberId))
    .limit(1);

  return member ?? null;
}

/**
 * Resolves the canonical Member identity for a legacy Scorer ID.
 * Returns Member if a confident, active link exists; otherwise null.
 */
export async function resolveMemberForLegacyScorer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  scorerId: number,
): Promise<Member | null> {
  const [link] = await database
    .select()
    .from(memberIdentityLinksTable)
    .where(
      and(
        eq(memberIdentityLinksTable.sourceTable, "scorer_accounts"),
        eq(memberIdentityLinksTable.sourceRecordId, String(scorerId)),
        eq(memberIdentityLinksTable.status, "active"),
      ),
    )
    .limit(1);

  if (!link) return null;

  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, link.memberId))
    .limit(1);

  return member ?? null;
}

/**
 * Resolves the canonical Member identity for a legacy Player record.
 * Respects Category A rules (confidenceScore === 100).
 * Category B/C or unlinked players return null.
 */
export async function resolveMemberForLegacyPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  params: {
    sourceTable: "players" | "global_players" | "badminton_players";
    sourceRecordId: number | string;
  },
): Promise<Member | null> {
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

  // Guard: Category A only (confidenceScore = 100)
  if (!link || link.confidenceScore < 100) return null;

  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, link.memberId))
    .limit(1);

  return member ?? null;
}

/**
 * Resolves the canonical Member identity for a Team Owner in a tournament.
 * Uses canonical tournament_participations with role 'team_owner' or 'owner'.
 */
export async function resolveMemberForLegacyOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  params: {
    tournamentId: number;
    teamId: number;
  },
): Promise<Member | null> {
  const [participation] = await database
    .select()
    .from(tournamentParticipationsTable)
    .where(
      and(
        eq(tournamentParticipationsTable.tournamentId, params.tournamentId),
        eq(tournamentParticipationsTable.teamId, params.teamId),
        eq(tournamentParticipationsTable.status, "active"),
      ),
    )
    .limit(1);

  if (!participation) return null;

  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, participation.memberId))
    .limit(1);

  return member ?? null;
}
