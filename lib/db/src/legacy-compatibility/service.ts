import { eq, and, sql, desc, lt, count } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { membersTable, type Member } from "../schema/members";
import {
  memberIdentityLinksTable,
  type MemberIdentityLink,
} from "../schema/member-identity-links";
import { organizersTable } from "../schema/organizers";
import { scorerAccountsTable } from "../schema/scorer_accounts";
import { globalPlayersTable } from "../schema/global_players";
import { playersTable } from "../schema/players";
import { badmintonPlayersTable } from "../schema/badminton";
import { scoringOfficialsTable } from "../schema/scoring_officials";
import { teamsTable } from "../schema/teams";
import { tournamentParticipationsTable } from "../schema/tournament-participations";
import type {
  LegacyIdentityResolutionResult,
  LegacyResolutionStatus,
  LegacySourceTable,
  MigrationReadinessReport,
  SourceMigrationMetrics,
  ListReviewCandidatesFilter,
} from "./types";

/**
 * Resolves a legacy record ID against canonical Member identities.
 * Returns structured resolution result: 'resolved', 'unresolved', or 'review_required'.
 * Never guesses or fabricates identity links.
 */
export async function resolveLegacyIdentity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  sourceTable: LegacySourceTable,
  sourceRecordId: string | number,
): Promise<LegacyIdentityResolutionResult> {
  const recordIdStr = String(sourceRecordId);

  const [link] = await database
    .select()
    .from(memberIdentityLinksTable)
    .where(
      and(
        eq(memberIdentityLinksTable.sourceTable, sourceTable),
        eq(memberIdentityLinksTable.sourceRecordId, recordIdStr),
      ),
    )
    .limit(1);

  // Case 1: No link exists
  if (!link) {
    return {
      status: "unresolved",
      memberId: null,
      member: null,
      sourceTable,
      sourceRecordId: recordIdStr,
      confidenceScore: null,
      linkId: null,
      reason: "No canonical identity link exists for this legacy record",
      provenance: null,
    };
  }

  // Case 2: Link exists but is inactive or pending review
  if (link.status === "pending_review" || link.status === "disputed" || link.confidenceScore < 100) {
    return {
      status: "review_required",
      memberId: link.memberId,
      member: null,
      sourceTable,
      sourceRecordId: recordIdStr,
      confidenceScore: link.confidenceScore,
      linkId: link.id,
      reason: `Identity link status '${link.status}' with confidence score ${link.confidenceScore}% requires manual review`,
      provenance: (link.provenanceJson as Record<string, unknown>) ?? null,
    };
  }

  // Case 3: Link is active with 100% confidence (Category A)
  if (link.status === "active" && link.confidenceScore === 100) {
    const [member] = await database
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, link.memberId))
      .limit(1);

    if (!member) {
      return {
        status: "unresolved",
        memberId: link.memberId,
        member: null,
        sourceTable,
        sourceRecordId: recordIdStr,
        confidenceScore: 100,
        linkId: link.id,
        reason: "Linked canonical Member record not found in database",
        provenance: (link.provenanceJson as Record<string, unknown>) ?? null,
      };
    }

    if (member.accountStatus === "suspended" || member.accountStatus === "deactivated") {
      return {
        status: "unresolved",
        memberId: member.id,
        member: null,
        sourceTable,
        sourceRecordId: recordIdStr,
        confidenceScore: 100,
        linkId: link.id,
        reason: `Canonical Member account is ${member.accountStatus}`,
        provenance: (link.provenanceJson as Record<string, unknown>) ?? null,
      };
    }

    return {
      status: "resolved",
      memberId: member.id,
      member,
      sourceTable,
      sourceRecordId: recordIdStr,
      confidenceScore: 100,
      linkId: link.id,
      reason: "Active Category A verified canonical identity link",
      provenance: (link.provenanceJson as Record<string, unknown>) ?? null,
    };
  }

  return {
    status: "unresolved",
    memberId: null,
    member: null,
    sourceTable,
    sourceRecordId: recordIdStr,
    confidenceScore: link.confidenceScore,
    linkId: link.id,
    reason: "Legacy record link could not be validated",
    provenance: (link.provenanceJson as Record<string, unknown>) ?? null,
  };
}

/**
 * Resolves a legacy Organizer ID.
 */
export async function resolveLegacyOrganizer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  organizerId: number,
): Promise<LegacyIdentityResolutionResult> {
  return resolveLegacyIdentity(database, "organizers", organizerId);
}

/**
 * Resolves a legacy Scorer ID.
 */
export async function resolveLegacyScorer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  scorerId: number,
): Promise<LegacyIdentityResolutionResult> {
  return resolveLegacyIdentity(database, "scorer_accounts", scorerId);
}

/**
 * Resolves a legacy Player ID (from players table).
 */
export async function resolveLegacyPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  playerId: number,
): Promise<LegacyIdentityResolutionResult> {
  return resolveLegacyIdentity(database, "players", playerId);
}

/**
 * Resolves a legacy Global Player ID.
 */
export async function resolveLegacyGlobalPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  globalPlayerId: string,
): Promise<LegacyIdentityResolutionResult> {
  return resolveLegacyIdentity(database, "global_players", globalPlayerId);
}

/**
 * Resolves a legacy Badminton Player ID.
 */
export async function resolveLegacyBadmintonPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  badmintonPlayerId: number,
): Promise<LegacyIdentityResolutionResult> {
  return resolveLegacyIdentity(database, "badminton_players", badmintonPlayerId);
}

/**
 * Resolves a legacy Scoring Official ID.
 * Scoring officials default to review_required or unresolved unless explicitly linked.
 */
export async function resolveLegacyOfficial(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  officialId: number,
): Promise<LegacyIdentityResolutionResult> {
  return resolveLegacyIdentity(database, "scoring_officials", officialId);
}

/**
 * Resolves a legacy Team Owner by tournamentId and teamId.
 */
export async function resolveLegacyOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  tournamentId: number,
  teamId: number,
): Promise<LegacyIdentityResolutionResult> {
  // Check if active canonical participation exists for team_owner
  const [participation] = await database
    .select()
    .from(tournamentParticipationsTable)
    .where(
      and(
        eq(tournamentParticipationsTable.tournamentId, tournamentId),
        eq(tournamentParticipationsTable.teamId, teamId),
        eq(tournamentParticipationsTable.status, "active"),
      ),
    )
    .limit(1);

  if (participation) {
    const [member] = await database
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, participation.memberId))
      .limit(1);

    if (member && member.accountStatus === "active") {
      return {
        status: "resolved",
        memberId: member.id,
        member,
        sourceTable: "teams_owner",
        sourceRecordId: String(teamId),
        confidenceScore: 100,
        linkId: null,
        reason: "Active canonical team owner tournament participation",
        provenance: null,
      };
    }
  }

  // Fallback to member_identity_links for teams_owner
  return resolveLegacyIdentity(database, "teams_owner", teamId);
}

/**
 * Lists identity links requiring manual review.
 */
export async function listMigrationReviewCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  filter: ListReviewCandidatesFilter = {},
): Promise<MemberIdentityLink[]> {
  const conditions = [lt(memberIdentityLinksTable.confidenceScore, 100)];

  if (filter.sourceTable) {
    conditions.push(eq(memberIdentityLinksTable.sourceTable, filter.sourceTable));
  }

  let query = database
    .select()
    .from(memberIdentityLinksTable)
    .where(and(...conditions))
    .orderBy(desc(memberIdentityLinksTable.createdAt));

  if (filter.limit) {
    query = query.limit(filter.limit) as any;
  }
  if (filter.offset) {
    query = query.offset(filter.offset) as any;
  }

  return await query;
}

/**
 * Computes a comprehensive, read-only Migration Readiness Report across all legacy sources.
 * ZERO data mutation performed.
 */
export async function getMigrationReadinessReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
): Promise<MigrationReadinessReport> {
  const sourceTables: { sourceTable: string; queryTotal: () => Promise<number> }[] = [
    {
      sourceTable: "organizers",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(organizersTable);
        return Number(r?.count ?? 0);
      },
    },
    {
      sourceTable: "scorer_accounts",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(scorerAccountsTable);
        return Number(r?.count ?? 0);
      },
    },
    {
      sourceTable: "global_players",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(globalPlayersTable);
        return Number(r?.count ?? 0);
      },
    },
    {
      sourceTable: "players",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(playersTable);
        return Number(r?.count ?? 0);
      },
    },
    {
      sourceTable: "badminton_players",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(badmintonPlayersTable);
        return Number(r?.count ?? 0);
      },
    },
    {
      sourceTable: "scoring_officials",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(scoringOfficialsTable);
        return Number(r?.count ?? 0);
      },
    },
    {
      sourceTable: "teams_owner",
      queryTotal: async () => {
        const [r] = await database.select({ count: count() }).from(teamsTable);
        return Number(r?.count ?? 0);
      },
    },
  ];

  const sourceMetrics: SourceMigrationMetrics[] = [];
  let totalRecordsSum = 0;
  let totalResolvedSum = 0;
  let totalUnresolvedSum = 0;
  let totalReviewRequiredSum = 0;

  for (const src of sourceTables) {
    const totalRecords = await src.queryTotal();
    totalRecordsSum += totalRecords;

    const links = await database
      .select()
      .from(memberIdentityLinksTable)
      .where(eq(memberIdentityLinksTable.sourceTable, src.sourceTable));

    let resolvedCount = 0;
    let reviewRequiredCount = 0;
    let categoryACount = 0;
    let categoryBCount = 0;
    let categoryCCount = 0;

    for (const link of links) {
      if (link.confidenceScore === 100 && link.status === "active") {
        resolvedCount++;
        categoryACount++;
      } else if (link.confidenceScore >= 50 || link.status === "pending_review") {
        reviewRequiredCount++;
        categoryBCount++;
      } else {
        categoryCCount++;
      }
    }

    const linkedRecordsCount = resolvedCount + reviewRequiredCount;
    const unresolvedCount = Math.max(0, totalRecords - resolvedCount - reviewRequiredCount);
    categoryCCount += unresolvedCount;

    totalResolvedSum += resolvedCount;
    totalReviewRequiredSum += reviewRequiredCount;
    totalUnresolvedSum += unresolvedCount;

    sourceMetrics.push({
      sourceTable: src.sourceTable,
      totalRecords,
      resolvedCount,
      unresolvedCount,
      reviewRequiredCount,
      categoryACount,
      categoryBCount,
      categoryCCount,
    });
  }

  const readinessPercentage =
    totalRecordsSum > 0 ? Number(((totalResolvedSum / totalRecordsSum) * 100).toFixed(2)) : 0;

  return {
    generatedAt: new Date().toISOString(),
    sources: sourceMetrics,
    totalRecords: totalRecordsSum,
    totalResolved: totalResolvedSum,
    totalUnresolved: totalUnresolvedSum,
    totalReviewRequired: totalReviewRequiredSum,
    readinessPercentage,
  };
}
