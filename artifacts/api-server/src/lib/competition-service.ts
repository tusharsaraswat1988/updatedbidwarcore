import { createHash } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import {
  badmintonPlayersTable,
  badmintonRegistrationsTable,
  competitionConfigurationHistoryTable,
  db,
  playersTable,
  tournamentsTable,
} from "@workspace/db";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import {
  buildCompetitionPlanPayload,
  buildCompetitionStatus,
  mapAuctionPlayersToParticipants,
  mapBadmintonRegistrationsToParticipants,
  resolveCompetitionConfiguration,
  resolveTransitionRequest,
  validateCompetitionConfiguration,
  type CompetitionAggregate,
  type CompetitionConfiguration,
  type CompetitionPlan,
  type CompetitionPlanPayload,
  type CompetitionValidationResult,
  type Participant,
  type RuleOverridesDocument,
  type TournamentTransitionRequest,
} from "@workspace/platform-core/competition";

export async function loadTournamentCompetitionRow(tournamentId: number) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  return tournament ?? null;
}

export async function loadLatestPlan(tournamentId: number): Promise<CompetitionPlan | null> {
  const [row] = await db
    .select()
    .from(competitionConfigurationHistoryTable)
    .where(eq(competitionConfigurationHistoryTable.tournamentId, tournamentId))
    .orderBy(desc(competitionConfigurationHistoryTable.version))
    .limit(1);
  if (!row) return null;
  return {
    tournamentId,
    version: row.version,
    payload: row.payloadJson as CompetitionPlanPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  };
}

export function buildWorkingConfiguration(
  tournament: typeof tournamentsTable.$inferSelect,
  plan: CompetitionPlan | null,
): CompetitionConfiguration {
  return resolveCompetitionConfiguration(tournament, {
    locked: !!plan,
    planVersion: plan?.version ?? null,
  });
}

export async function loadParticipants(tournament: {
  id: number;
  sport: string | null;
}): Promise<Participant[]> {
  const sportId = (tournament.sport ?? "cricket").toLowerCase();
  if (sportId === "badminton") {
    const regs = await db
      .select({
        id: badmintonRegistrationsTable.id,
        status: badmintonRegistrationsTable.status,
        player1Id: badmintonRegistrationsTable.player1Id,
        player2Id: badmintonRegistrationsTable.player2Id,
        p1First: badmintonPlayersTable.firstName,
        p1Last: badmintonPlayersTable.lastName,
        p1Display: badmintonPlayersTable.displayName,
      })
      .from(badmintonRegistrationsTable)
      .leftJoin(
        badmintonPlayersTable,
        eq(badmintonRegistrationsTable.player1Id, badmintonPlayersTable.id),
      )
      .where(eq(badmintonRegistrationsTable.tournamentId, tournament.id));

    // Load player2 names in a second pass for doubles (simple, clear).
    const player2Ids = [
      ...new Set(regs.map((r) => r.player2Id).filter((id): id is number => id != null)),
    ];
    const p2Rows =
      player2Ids.length > 0
        ? await db
            .select({
              id: badmintonPlayersTable.id,
              firstName: badmintonPlayersTable.firstName,
              lastName: badmintonPlayersTable.lastName,
              displayName: badmintonPlayersTable.displayName,
            })
            .from(badmintonPlayersTable)
            .where(inArray(badmintonPlayersTable.id, player2Ids))
        : [];
    const p2ById = new Map(p2Rows.map((p) => [p.id, p]));

    return mapBadmintonRegistrationsToParticipants(
      "badminton",
      regs.map((r) => {
        const p2 = r.player2Id != null ? p2ById.get(r.player2Id) : undefined;
        const p1Name =
          r.p1Display ||
          [r.p1First, r.p1Last].filter(Boolean).join(" ") ||
          `Player ${r.player1Id}`;
        const p2Name = p2
          ? p2.displayName || [p2.firstName, p2.lastName].filter(Boolean).join(" ")
          : null;
        return {
          id: r.id,
          status: r.status,
          player1Name: p1Name,
          player2Name: p2Name,
          matchType: p2Name ? "doubles" : "singles",
        };
      }),
    );
  }

  const players = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      status: playersTable.status,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournament.id));

  return mapAuctionPlayersToParticipants(sportId, players);
}

export async function buildCompetitionAggregate(
  tournamentId: number,
): Promise<CompetitionAggregate | null> {
  const tournament = await loadTournamentCompetitionRow(tournamentId);
  if (!tournament) return null;
  const plan = await loadLatestPlan(tournamentId);
  const configuration = buildWorkingConfiguration(tournament, plan);
  const validation = validateCompetitionConfiguration(configuration);
  const status = buildCompetitionStatus(configuration, validation);
  const participants = await loadParticipants(tournament);
  return {
    configuration,
    plan,
    validation,
    summary: {
      status,
      participantCount: participants.length,
    },
  };
}

export function checksumPayload(payload: CompetitionPlanPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export type LockCompetitionResult =
  | {
      ok: true;
      plan: CompetitionPlan;
      validation: CompetitionValidationResult;
      transition: TournamentTransitionRequest;
      tournamentTransitionResult: {
        requested: string | null;
        applied: boolean;
        previousStatus: string | null;
        currentStatus: string | null;
        note: string;
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: CompetitionValidationResult;
    };

/**
 * Lock Competition Setup — freeze once.
 * Does not hard-mutate tournament.status when product state machine is not enforced;
 * records Transition Rules request and optionally sets status when still in setup/draft.
 */
export async function lockCompetitionSetup(
  tournamentId: number,
  frozenBy: string | null,
): Promise<LockCompetitionResult> {
  const tournament = await loadTournamentCompetitionRow(tournamentId);
  if (!tournament) {
    return { ok: false, status: 404, error: "Tournament not found" };
  }

  const existing = await loadLatestPlan(tournamentId);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "Competition Setup is already locked. Re-freeze is not allowed in this epic.",
    };
  }

  const configuration = buildWorkingConfiguration(tournament, null);
  const validation = validateCompetitionConfiguration(configuration);
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Competition Setup has blocking validation errors",
      validation,
    };
  }

  const frozenAt = new Date().toISOString();
  const payload = buildCompetitionPlanPayload(configuration, validation, frozenAt);
  const checksum = checksumPayload(payload);

  const [inserted] = await db
    .insert(competitionConfigurationHistoryTable)
    .values({
      tournamentId,
      version: 1,
      payloadJson: payload as unknown as Record<string, unknown>,
      checksum,
      frozenBy,
    })
    .returning();

  const transition = resolveTransitionRequest(configuration, "configuration_locked");

  const previousStatus = tournament.status ?? null;
  let applied = false;
  let currentStatus = previousStatus;

  // Soft apply: only when tournament is still in early setup and Transition Rules request a state.
  const early =
    !previousStatus ||
    previousStatus === "setup" ||
    previousStatus === "draft" ||
    previousStatus === "Draft" ||
    previousStatus === "Setup";
  if (early && transition.requestedTournamentState) {
    await db
      .update(tournamentsTable)
      .set({
        businessStageId: "configuration_locked",
        status: transition.requestedTournamentState,
        updatedAt: new Date(),
      })
      .where(eq(tournamentsTable.id, tournamentId));
    applied = true;
    currentStatus = transition.requestedTournamentState;
  } else {
    await db
      .update(tournamentsTable)
      .set({
        businessStageId: "configuration_locked",
        updatedAt: new Date(),
      })
      .where(eq(tournamentsTable.id, tournamentId));
  }

  return {
    ok: true,
    plan: {
      tournamentId,
      version: inserted.version,
      payload,
      frozenAt: inserted.createdAt.toISOString(),
      frozenBy: inserted.frozenBy,
    },
    validation,
    transition,
    tournamentTransitionResult: {
      requested: transition.requestedTournamentState,
      applied,
      previousStatus,
      currentStatus,
      note: applied
        ? "Tournament status updated per Transition Rules request."
        : "Transition Rules request recorded; Tournament State Machine did not auto-apply (not early setup).",
    },
  };
}

export async function patchCompetitionConfiguration(
  tournamentId: number,
  patch: {
    competitionTypeId?: string | null;
    variantId?: string | null;
    ruleProfileId?: string | null;
    ruleProfileVersion?: string | null;
    presentationProfileId?: string | null;
    presentationProfileVersion?: string | null;
    registrationModeId?: string | null;
    teamFormationStrategyId?: string | null;
    squadRules?: Record<string, unknown> | null;
    ruleOverrides?: RuleOverridesDocument | null;
    participantConstraints?: Record<string, unknown> | null;
    businessStageId?: string | null;
  },
): Promise<{ ok: true; configuration: CompetitionConfiguration } | { ok: false; status: number; error: string }> {
  const existing = await loadLatestPlan(tournamentId);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "Competition Setup is locked. Working Configuration cannot be edited.",
    };
  }

  const tournament = await loadTournamentCompetitionRow(tournamentId);
  if (!tournament) {
    return { ok: false, status: 404, error: "Tournament not found" };
  }

  const nextCompetitionTypeId =
    patch.competitionTypeId !== undefined
      ? patch.competitionTypeId
      : tournament.competitionTypeId;
  const nextVariantId =
    patch.variantId !== undefined ? patch.variantId : tournament.variantId;

  let nextRegistrationModeId =
    patch.registrationModeId !== undefined
      ? patch.registrationModeId
      : tournament.registrationModeId;
  let nextTeamFormationStrategyId =
    patch.teamFormationStrategyId !== undefined
      ? patch.teamFormationStrategyId
      : tournament.teamFormationStrategyId;

  // Drop incompatible entry choices when competition type changes.
  if (nextCompetitionTypeId) {
    const modes = CatalogRegistry.listRegistrationModes(nextCompetitionTypeId);
    if (
      nextRegistrationModeId &&
      !modes.some((m) => m.id === nextRegistrationModeId)
    ) {
      if (patch.registrationModeId !== undefined) {
        return {
          ok: false,
          status: 400,
          error: "registrationModeId is not compatible with competitionTypeId",
        };
      }
      nextRegistrationModeId = null;
    }
    const strategies = CatalogRegistry.listTeamFormationStrategies(nextCompetitionTypeId);
    if (
      nextTeamFormationStrategyId &&
      !strategies.some((s) => s.id === nextTeamFormationStrategyId)
    ) {
      if (patch.teamFormationStrategyId !== undefined) {
        return {
          ok: false,
          status: 400,
          error: "teamFormationStrategyId is not compatible with competitionTypeId",
        };
      }
      nextTeamFormationStrategyId = null;
    }
  }

  let nextRuleProfileId =
    patch.ruleProfileId !== undefined ? patch.ruleProfileId : tournament.ruleProfileId;
  let nextRuleProfileVersion =
    patch.ruleProfileVersion !== undefined
      ? patch.ruleProfileVersion
      : tournament.ruleProfileVersion;
  let nextPresentationProfileId =
    patch.presentationProfileId !== undefined
      ? patch.presentationProfileId
      : tournament.presentationProfileId;
  let nextPresentationProfileVersion =
    patch.presentationProfileVersion !== undefined
      ? patch.presentationProfileVersion
      : tournament.presentationProfileVersion;

  const sportId = tournament.sport ?? "cricket";
  if (sportId && nextVariantId && nextCompetitionTypeId) {
    const ruleStillValid =
      nextRuleProfileId &&
      CatalogRegistry.listRuleProfiles({
        sportId,
        variantId: nextVariantId,
        competitionTypeId: nextCompetitionTypeId,
      }).some((p) => p.id === nextRuleProfileId);
    const presentationStillValid =
      nextPresentationProfileId &&
      CatalogRegistry.listPresentationProfiles({
        sportId,
        variantId: nextVariantId,
        competitionTypeId: nextCompetitionTypeId,
      }).some((p) => p.id === nextPresentationProfileId);

    if (!ruleStillValid || !presentationStillValid) {
      const suggested = CatalogRegistry.suggestDefaults({
        sportId,
        variantId: nextVariantId,
        competitionTypeId: nextCompetitionTypeId,
      });
      if (!ruleStillValid && suggested.ruleProfile) {
        nextRuleProfileId = suggested.ruleProfile.id;
        nextRuleProfileVersion = suggested.ruleProfile.version;
      }
      if (!presentationStillValid && suggested.presentationProfile) {
        nextPresentationProfileId = suggested.presentationProfile.id;
        nextPresentationProfileVersion = suggested.presentationProfile.version;
      }
    }
  }

  const profileChanged =
    nextRuleProfileId !== tournament.ruleProfileId ||
    nextRuleProfileVersion !== tournament.ruleProfileVersion;

  // Spec: changing playing-rules profile clears overrides unless this PATCH sets new ones.
  let nextRuleOverridesJson: RuleOverridesDocument | null | undefined;
  if (patch.ruleOverrides !== undefined) {
    nextRuleOverridesJson = patch.ruleOverrides;
  } else if (profileChanged) {
    nextRuleOverridesJson = null;
  }

  const [updated] = await db
    .update(tournamentsTable)
    .set({
      ...(patch.competitionTypeId !== undefined
        ? { competitionTypeId: patch.competitionTypeId }
        : {}),
      ...(patch.variantId !== undefined ? { variantId: patch.variantId } : {}),
      ...(profileChanged
        ? {
            ruleProfileId: nextRuleProfileId,
            ruleProfileVersion: nextRuleProfileVersion,
          }
        : {}),
      ...(nextPresentationProfileId !== tournament.presentationProfileId ||
      nextPresentationProfileVersion !== tournament.presentationProfileVersion
        ? {
            presentationProfileId: nextPresentationProfileId,
            presentationProfileVersion: nextPresentationProfileVersion,
          }
        : {}),
      ...(nextRegistrationModeId !== tournament.registrationModeId
        ? { registrationModeId: nextRegistrationModeId }
        : {}),
      ...(nextTeamFormationStrategyId !== tournament.teamFormationStrategyId
        ? { teamFormationStrategyId: nextTeamFormationStrategyId }
        : {}),
      ...(patch.squadRules !== undefined ? { squadRulesJson: patch.squadRules } : {}),
      ...(nextRuleOverridesJson !== undefined
        ? { ruleOverridesJson: nextRuleOverridesJson }
        : {}),
      ...(patch.participantConstraints !== undefined
        ? { participantConstraintsJson: patch.participantConstraints }
        : {}),
      ...(patch.businessStageId !== undefined
        ? { businessStageId: patch.businessStageId }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(tournamentsTable.id, tournamentId))
    .returning();

  return {
    ok: true,
    configuration: buildWorkingConfiguration(updated, null),
  };
}
