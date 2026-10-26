import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { membersTable, type Member } from "../schema/members";
import { memberRolesTable, type MemberRole } from "../schema/member-roles";
import {
  tournamentParticipationsTable,
  type TournamentParticipation,
} from "../schema/tournament-participations";
import {
  memberSportProfilesTable,
  type MemberSportProfile,
} from "../schema/member-sport-profiles";
import { organizersTable } from "../schema/organizers";
import { scorerAccountsTable } from "../schema/scorer_accounts";
import {
  resolveMemberCapabilities,
  checkCapability,
} from "../member-auth/capabilities";
import { validateMemberSession } from "../member-auth/service";
import {
  resolveLegacyOrganizer,
  resolveLegacyScorer,
  resolveLegacyPlayer,
  resolveLegacyBadmintonPlayer,
  resolveLegacyGlobalPlayer,
  resolveLegacyOwner,
  resolveLegacyOfficial,
} from "../legacy-compatibility/service";
import type {
  MemberRuntimeContext,
  RuntimeAuthInput,
  RuntimeContextParams,
  IdentitySource,
  CanonicalResolutionStatus,
  LegacyIdentityContext,
} from "./types";

/**
 * Resolves full runtime context for an incoming request.
 * Completely read-only: performs ZERO writes/mutations to legacy or canonical tables.
 */
export async function resolveMemberRuntimeContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  authInput: RuntimeAuthInput = {},
  params: RuntimeContextParams = {},
): Promise<MemberRuntimeContext> {
  const startTime = Date.now();
  const tournamentId = params.tournamentId ?? authInput.ownerTournamentId ?? null;
  const teamId = params.teamId ?? authInput.ownerTeamId ?? null;
  const matchId = params.matchId ?? null;

  let identitySource: IdentitySource = "anonymous";
  let canonicalResolutionStatus: CanonicalResolutionStatus = "anonymous";
  let member: Member | null = null;
  let legacyIdentity: LegacyIdentityContext | null = null;
  let linkId: number | null = null;
  let sourceTable: string | undefined = undefined;

  const combinedRoles: MemberRole[] = [];

  // Handle Admin elevation if present
  if (authInput.isAdmin) {
    combinedRoles.push({
      id: 0,
      memberId: "admin",
      role: authInput.adminLevel === "master" ? "master_admin" : "admin",
      scope: "global",
      tournamentId: null,
      teamId: null,
      matchId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Case 1: Direct Canonical Member Session
  if (authInput.canonicalSessionId) {
    try {
      const validated = await validateMemberSession(
        database,
        authInput.canonicalSessionId,
      );
      member = validated.member;
      identitySource = "canonical_member";
      canonicalResolutionStatus = "native";
    } catch {
      // Invalid canonical session falls back to unauthenticated / anonymous
      member = null;
    }
  }

  // Case 2: Legacy Organizer
  else if (authInput.organizerAccountId != null) {
    identitySource = "legacy_organizer";
    sourceTable = "organizers";

    const [org] = await database
      .select({
        id: organizersTable.id,
        name: organizersTable.name,
        email: organizersTable.email,
        mobile: organizersTable.mobile,
      })
      .from(organizersTable)
      .where(eq(organizersTable.id, authInput.organizerAccountId))
      .limit(1);

    legacyIdentity = {
      type: "organizer",
      id: authInput.organizerAccountId,
      name: org?.name ?? null,
      email: org?.email ?? null,
      mobile: org?.mobile ?? null,
    };

    const res = await resolveLegacyOrganizer(database, authInput.organizerAccountId);
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }

    // Grant organizer capability for owned tournaments in JWT
    if (authInput.organizerTournaments) {
      for (const ownedTid of Object.keys(authInput.organizerTournaments)) {
        const tidNum = Number(ownedTid);
        if (!Number.isNaN(tidNum)) {
          combinedRoles.push({
            id: 0,
            memberId: member?.id ?? `org_${authInput.organizerAccountId}`,
            role: "organizer",
            scope: "tournament",
            tournamentId: tidNum,
            teamId: null,
            matchId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  // Case 3: Legacy Scorer
  else if (authInput.scorerId != null) {
    identitySource = "legacy_scorer";
    sourceTable = "scorer_accounts";

    const [scorer] = await database
      .select({
        id: scorerAccountsTable.id,
        name: scorerAccountsTable.name,
        mobile: scorerAccountsTable.mobile,
        isActive: scorerAccountsTable.isActive,
      })
      .from(scorerAccountsTable)
      .where(eq(scorerAccountsTable.id, authInput.scorerId))
      .limit(1);

    legacyIdentity = {
      type: "scorer",
      id: authInput.scorerId,
      name: scorer?.name ?? null,
      mobile: scorer?.mobile ?? null,
    };

    const res = await resolveLegacyScorer(database, authInput.scorerId);
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }

    // Scorer role scoped to active tournament context if scorer is active
    if (scorer?.isActive !== false && tournamentId != null) {
      combinedRoles.push({
        id: 0,
        memberId: member?.id ?? `scorer_${authInput.scorerId}`,
        role: "scorer",
        scope: "tournament",
        tournamentId,
        teamId: null,
        matchId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Case 4: Legacy Team Owner
  else if (authInput.ownerTournamentId != null && authInput.ownerTeamId != null) {
    identitySource = "legacy_owner";
    sourceTable = "teams_owner";

    legacyIdentity = {
      type: "owner",
      tournamentId: authInput.ownerTournamentId,
      teamId: authInput.ownerTeamId,
    };

    const res = await resolveLegacyOwner(
      database,
      authInput.ownerTournamentId,
      authInput.ownerTeamId,
    );
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }

    // Team owner role strictly scoped to ownerTeamId in ownerTournamentId
    combinedRoles.push({
      id: 0,
      memberId: member?.id ?? `owner_${authInput.ownerTeamId}`,
      role: "team_owner",
      scope: "team",
      tournamentId: authInput.ownerTournamentId,
      teamId: authInput.ownerTeamId,
      matchId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Case 5: Legacy Player
  else if (authInput.playerId != null) {
    identitySource = "legacy_player";
    sourceTable = "players";
    legacyIdentity = { type: "player", id: authInput.playerId };

    const res = await resolveLegacyPlayer(database, authInput.playerId);
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }
  }

  // Case 6: Legacy Badminton Player
  else if (authInput.badmintonPlayerId != null) {
    identitySource = "legacy_badminton_player";
    sourceTable = "badminton_players";
    legacyIdentity = { type: "badminton_player", id: authInput.badmintonPlayerId };

    const res = await resolveLegacyBadmintonPlayer(
      database,
      authInput.badmintonPlayerId,
    );
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }
  }

  // Case 7: Legacy Global Player
  else if (authInput.globalPlayerId != null) {
    identitySource = "legacy_player";
    sourceTable = "global_players";
    legacyIdentity = { type: "player", id: authInput.globalPlayerId };

    const res = await resolveLegacyGlobalPlayer(database, authInput.globalPlayerId);
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }
  }

  // Case 8: Legacy Official
  else if (authInput.officialId != null) {
    identitySource = "legacy_official";
    sourceTable = "scoring_officials";
    legacyIdentity = { type: "official", id: authInput.officialId };

    const res = await resolveLegacyOfficial(database, authInput.officialId);
    canonicalResolutionStatus = res.status;
    linkId = res.linkId;

    if (res.status === "resolved" && res.member) {
      member = res.member;
    }
  }

  // Load canonical details if canonical Member is present
  let globalRoles: string[] = [];
  let tournamentParticipations: TournamentParticipation[] = [];
  let sportProfiles: MemberSportProfile[] = [];

  if (member) {
    // 1. Fetch Member roles
    const roles = await database
      .select()
      .from(memberRolesTable)
      .where(eq(memberRolesTable.memberId, member.id));

    for (const r of roles) {
      combinedRoles.push(r);
      if (r.scope === "global") {
        globalRoles.push(r.role);
      }
    }

    // 2. Fetch Tournament Participations
    if (tournamentId != null) {
      tournamentParticipations = await database
        .select()
        .from(tournamentParticipationsTable)
        .where(
          and(
            eq(tournamentParticipationsTable.memberId, member.id),
            eq(tournamentParticipationsTable.tournamentId, tournamentId),
          ),
        );

      for (const p of tournamentParticipations) {
        if (p.status === "active") {
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
      }
    }

    // 3. Fetch Sport Profiles
    sportProfiles = await database
      .select()
      .from(memberSportProfilesTable)
      .where(eq(memberSportProfilesTable.memberId, member.id));
  }

  // Resolve active capabilities for current context
  const activeCapabilities = resolveMemberCapabilities(combinedRoles, {
    tournamentId: tournamentId ?? undefined,
    teamId: teamId ?? undefined,
    matchId: matchId ?? undefined,
  });

  return {
    identitySource,
    canonicalResolutionStatus,
    isCanonical: member != null,
    member,
    memberId: member?.id ?? null,
    legacyIdentity,
    globalRoles: Array.from(new Set(globalRoles)),
    tournamentParticipations,
    sportProfiles,
    capabilities: activeCapabilities,
    tournamentId,
    teamId,
    matchId,
    hasCapability: (
      cap: string,
      subContext?: { teamId?: number; matchId?: number },
    ) => {
      const activeCtx = {
        tournamentId: tournamentId ?? undefined,
        teamId: subContext?.teamId ?? teamId ?? undefined,
        matchId: subContext?.matchId ?? matchId ?? undefined,
      };
      const resolvedCaps = resolveMemberCapabilities(combinedRoles, activeCtx);
      return checkCapability(resolvedCaps, cap);
    },
    diagnostics: {
      resolutionTimeMs: Date.now() - startTime,
      linkId,
      sourceTable,
    },
  };
}
