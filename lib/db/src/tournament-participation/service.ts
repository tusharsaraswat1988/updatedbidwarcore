import { eq, and, inArray, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { membersTable, type Member } from "../schema/members";
import { tournamentsTable, type Tournament } from "../schema/tournaments";
import { teamsTable } from "../schema/teams";
import {
  tournamentParticipationsTable,
  type TournamentParticipation,
} from "../schema/tournament-participations";
import { memberRolesTable, type MemberRole } from "../schema/member-roles";
import {
  validateParticipationRole,
  validateParticipationStatus,
  isActiveParticipation,
} from "./validation";
import {
  resolveMemberCapabilities,
  checkCapability,
} from "../member-auth/capabilities";
import type {
  CreateParticipationInput,
  UpdateParticipationInput,
  ListParticipationsFilter,
  MemberTournamentContext,
} from "./types";

export class TournamentParticipationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "TournamentParticipationError";
  }
}

/**
 * Creates a canonical participation relationship between a Member and a Tournament.
 */
export async function createTournamentParticipation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: CreateParticipationInput,
): Promise<TournamentParticipation> {
  const role = input.role.trim().toLowerCase();
  if (!validateParticipationRole(role)) {
    throw new TournamentParticipationError(
      `Invalid participation role: ${input.role}`,
      "INVALID_ROLE",
      400,
    );
  }

  const status = (input.status || "active").trim().toLowerCase();
  if (!validateParticipationStatus(status)) {
    throw new TournamentParticipationError(
      `Invalid participation status: ${input.status}`,
      "INVALID_STATUS",
      400,
    );
  }

  // 1. Verify Member exists and is active
  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, input.memberId))
    .limit(1);

  if (!member) {
    throw new TournamentParticipationError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  if (member.accountStatus === "suspended" || member.accountStatus === "deactivated") {
    throw new TournamentParticipationError(
      "Member account is inactive or suspended",
      "MEMBER_INACTIVE",
      403,
    );
  }

  // 2. Verify Tournament exists
  const [tournament] = await database
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, input.tournamentId))
    .limit(1);

  if (!tournament) {
    throw new TournamentParticipationError("Tournament not found", "TOURNAMENT_NOT_FOUND", 404);
  }

  // 3. Verify Team association if provided (must belong to this tournament)
  if (input.teamId != null) {
    const [team] = await database
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, input.teamId))
      .limit(1);

    if (!team) {
      throw new TournamentParticipationError("Team not found", "TEAM_NOT_FOUND", 404);
    }

    if (team.tournamentId !== input.tournamentId) {
      throw new TournamentParticipationError(
        "Team does not belong to the specified tournament",
        "CROSS_TOURNAMENT_TEAM_MISMATCH",
        400,
      );
    }
  }

  // 4. Check for duplicate canonical participation for (tournamentId, memberId, role)
  const [existing] = await database
    .select()
    .from(tournamentParticipationsTable)
    .where(
      and(
        eq(tournamentParticipationsTable.tournamentId, input.tournamentId),
        eq(tournamentParticipationsTable.memberId, input.memberId),
        eq(tournamentParticipationsTable.role, role),
      ),
    )
    .limit(1);

  if (existing) {
    throw new TournamentParticipationError(
      `Member already has a '${role}' participation in this tournament`,
      "DUPLICATE_PARTICIPATION",
      409,
    );
  }

  // 5. Insert participation
  const [created] = await database
    .insert(tournamentParticipationsTable)
    .values({
      tournamentId: input.tournamentId,
      memberId: input.memberId,
      role,
      status,
      teamId: input.teamId ?? null,
      categoryId: input.categoryId ?? null,
      displayNameOverride: input.displayNameOverride?.trim() || null,
      initials: input.initials?.trim() || null,
      jerseyNumber: input.jerseyNumber?.trim() || null,
      metadataJson: input.metadataJson ?? null,
    })
    .returning();

  return created!;
}

/**
 * Retrieves a single participation record by primary key.
 */
export async function getTournamentParticipation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  id: number,
): Promise<TournamentParticipation | null> {
  const [row] = await database
    .select()
    .from(tournamentParticipationsTable)
    .where(eq(tournamentParticipationsTable.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Retrieves a participation by (tournamentId, memberId, role).
 */
export async function getTournamentParticipationByMemberRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  tournamentId: number,
  memberId: string,
  role: string,
): Promise<TournamentParticipation | null> {
  const [row] = await database
    .select()
    .from(tournamentParticipationsTable)
    .where(
      and(
        eq(tournamentParticipationsTable.tournamentId, tournamentId),
        eq(tournamentParticipationsTable.memberId, memberId),
        eq(tournamentParticipationsTable.role, role.trim().toLowerCase()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * List participations matching filter criteria.
 */
export async function listTournamentParticipations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  filter: ListParticipationsFilter = {},
): Promise<TournamentParticipation[]> {
  const conditions = [];

  if (filter.tournamentId != null) {
    conditions.push(eq(tournamentParticipationsTable.tournamentId, filter.tournamentId));
  }
  if (filter.memberId != null) {
    conditions.push(eq(tournamentParticipationsTable.memberId, filter.memberId));
  }
  if (filter.role != null) {
    conditions.push(eq(tournamentParticipationsTable.role, filter.role.trim().toLowerCase()));
  }
  if (filter.teamId != null) {
    conditions.push(eq(tournamentParticipationsTable.teamId, filter.teamId));
  }
  if (filter.categoryId != null) {
    conditions.push(eq(tournamentParticipationsTable.categoryId, filter.categoryId));
  }
  if (filter.status != null) {
    if (Array.isArray(filter.status)) {
      conditions.push(inArray(tournamentParticipationsTable.status, filter.status));
    } else {
      conditions.push(eq(tournamentParticipationsTable.status, filter.status.trim().toLowerCase()));
    }
  }

  let query = database
    .select()
    .from(tournamentParticipationsTable)
    .orderBy(desc(tournamentParticipationsTable.createdAt));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  if (filter.limit != null) {
    query = query.limit(filter.limit) as any;
  }
  if (filter.offset != null) {
    query = query.offset(filter.offset) as any;
  }

  return await query;
}

/**
 * Update an existing participation.
 */
export async function updateTournamentParticipation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  id: number,
  patch: UpdateParticipationInput,
): Promise<TournamentParticipation> {
  const existing = await getTournamentParticipation(database, id);
  if (!existing) {
    throw new TournamentParticipationError("Participation record not found", "NOT_FOUND", 404);
  }

  const updateValues: Partial<typeof tournamentParticipationsTable.$inferInsert> = {};

  if (patch.status !== undefined) {
    const status = patch.status.trim().toLowerCase();
    if (!validateParticipationStatus(status)) {
      throw new TournamentParticipationError(
        `Invalid participation status: ${patch.status}`,
        "INVALID_STATUS",
        400,
      );
    }
    updateValues.status = status;
  }

  if (patch.teamId !== undefined) {
    if (patch.teamId !== null) {
      const [team] = await database
        .select()
        .from(teamsTable)
        .where(eq(teamsTable.id, patch.teamId))
        .limit(1);

      if (!team) {
        throw new TournamentParticipationError("Team not found", "TEAM_NOT_FOUND", 404);
      }
      if (team.tournamentId !== existing.tournamentId) {
        throw new TournamentParticipationError(
          "Team does not belong to the participation's tournament",
          "CROSS_TOURNAMENT_TEAM_MISMATCH",
          400,
        );
      }
    }
    updateValues.teamId = patch.teamId;
  }

  if (patch.categoryId !== undefined) {
    updateValues.categoryId = patch.categoryId;
  }
  if (patch.displayNameOverride !== undefined) {
    updateValues.displayNameOverride = patch.displayNameOverride?.trim() || null;
  }
  if (patch.initials !== undefined) {
    updateValues.initials = patch.initials?.trim() || null;
  }
  if (patch.jerseyNumber !== undefined) {
    updateValues.jerseyNumber = patch.jerseyNumber?.trim() || null;
  }
  if (patch.metadataJson !== undefined) {
    updateValues.metadataJson = patch.metadataJson;
  }

  const [updated] = await database
    .update(tournamentParticipationsTable)
    .set(updateValues)
    .where(eq(tournamentParticipationsTable.id, id))
    .returning();

  return updated!;
}

/**
 * Soft-removes a participation record, preserving historical record with 'removed' status.
 */
export async function removeTournamentParticipation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  id: number,
  reason?: string,
): Promise<TournamentParticipation> {
  const existing = await getTournamentParticipation(database, id);
  if (!existing) {
    throw new TournamentParticipationError("Participation record not found", "NOT_FOUND", 404);
  }

  const metadata = (existing.metadataJson as Record<string, unknown>) || {};
  metadata.removedAt = new Date().toISOString();
  if (reason) {
    metadata.removedReason = reason;
  }

  const [updated] = await database
    .update(tournamentParticipationsTable)
    .set({
      status: "removed",
      metadataJson: metadata,
    })
    .where(eq(tournamentParticipationsTable.id, id))
    .returning();

  return updated!;
}

/**
 * Resolves full member context in relation to a specific tournament.
 * Combines global Member roles, tournament-scoped Member roles, and active Tournament Participations.
 */
export async function resolveMemberTournamentContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  params: {
    tournamentId: number;
    memberId: string;
    teamId?: number;
    matchId?: number;
  },
): Promise<MemberTournamentContext> {
  // 1. Fetch Member
  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, params.memberId))
    .limit(1);

  if (!member) {
    throw new TournamentParticipationError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  // 2. Fetch Tournament
  const [tournament] = await database
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, params.tournamentId))
    .limit(1);

  if (!tournament) {
    throw new TournamentParticipationError("Tournament not found", "TOURNAMENT_NOT_FOUND", 404);
  }

  // 3. Fetch Tournament Participations for this member
  const participations = await database
    .select()
    .from(tournamentParticipationsTable)
    .where(
      and(
        eq(tournamentParticipationsTable.tournamentId, params.tournamentId),
        eq(tournamentParticipationsTable.memberId, params.memberId),
      ),
    );

  // 4. Fetch Member roles from member_roles table
  const memberRoles = await database
    .select()
    .from(memberRolesTable)
    .where(eq(memberRolesTable.memberId, params.memberId));

  // 5. Active participations grant tournament-scoped roles
  const activeParticipations = participations.filter((p) => isActiveParticipation(p.status));
  const activeRoles = Array.from(
    new Set(activeParticipations.map((p) => p.role.toLowerCase())),
  );

  // Determine active assigned teamId if any
  const teamParticipation = activeParticipations.find((p) => p.teamId != null);
  const activeTeamId = params.teamId ?? teamParticipation?.teamId ?? null;

  // Build combined roles for capability resolution
  const combinedRoles: MemberRole[] = [...memberRoles];
  for (const p of activeParticipations) {
    combinedRoles.push({
      id: 0,
      memberId: p.memberId,
      role: p.role,
      scope: p.teamId != null ? "team" : "tournament",
      tournamentId: p.tournamentId,
      teamId: p.teamId,
      matchId: null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  const contextCaps = resolveMemberCapabilities(combinedRoles, {
    tournamentId: params.tournamentId,
    teamId: activeTeamId ?? undefined,
    matchId: params.matchId,
  });

  return {
    member,
    tournament,
    participations,
    activeRoles,
    activeTeamId,
    capabilities: contextCaps,
    hasCapability: (cap: string, subContext?: { teamId?: number; matchId?: number }) => {
      const activeContext = {
        tournamentId: params.tournamentId,
        teamId: subContext?.teamId ?? activeTeamId ?? undefined,
        matchId: subContext?.matchId ?? params.matchId,
      };
      const resolved = resolveMemberCapabilities(combinedRoles, activeContext);
      return checkCapability(resolved, cap);
    },
  };
}
