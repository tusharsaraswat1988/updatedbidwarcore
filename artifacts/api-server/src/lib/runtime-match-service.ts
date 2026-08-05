import { and, desc, eq } from "drizzle-orm";
import {
  badmintonDrawsTable,
  badmintonFixturesTable,
  db,
  runtimeMatchHistoryTable,
  scoringDrawsTable,
  scoringFixturesTable,
  scoringMatchesTable,
} from "@workspace/db";
import { encodeFixtureId } from "@workspace/platform-core/fixture";
import { type MatchLifecycleStatusId } from "@workspace/platform-core/match";
import {
  buildFreezeHistoryPayload,
  buildRuntimeContextFromSnapshot,
  buildRuntimeHistoryEntry,
  buildRuntimeSnapshot,
  buildSnapshotReferences,
  isPhaseAllowedForLifecycle,
  isValidExecutionPhaseTransition,
  mapRowToExecutionPhaseState,
  mapRowToRuntimeIdentity,
  mapRowToRuntimeListItem,
  validateRuntimeMatch,
  type CompetitionStateForRuntime,
  type ExecutionPhaseId,
  type ExecutionPhaseState,
  type FixtureStateForRuntime,
  type MatchConfigStateForRuntime,
  type MatchIdentity,
  type RuntimeContext,
  type RuntimeHistoryEntry,
  type RuntimeMatchListItem,
  type RuntimeSnapshot,
  type RuntimeValidationResult,
  type SchedulingStateForRuntime,
} from "@workspace/platform-core/runtime-match";
import {
  buildWorkingConfiguration,
  loadLatestPlan,
  loadTournamentCompetitionRow,
} from "./competition-service";
import { buildCompetitionStatus, validateCompetitionConfiguration } from "@workspace/platform-core/competition";
import {
  loadLatestMatchHistory,
  loadMatchOfficials,
  loadMatchRow,
  loadMatchSides,
  listMatchRows,
  requestMatchLifecycleTransition,
} from "./match-service";
import { loadLatestFixtureHistory } from "./fixture-service";
import { loadLatestSchedulingHistory } from "./scheduling-service";


function toBridgeRow(match: typeof scoringMatchesTable.$inferSelect) {
  return {
    id: match.id,
    tournamentId: match.tournamentId,
    matchTypeId: match.matchTypeId,
    lifecycleStatus: match.lifecycleStatus,
    executionPhase: match.executionPhase,
    currentRuntimeVersion: match.currentRuntimeVersion,
    fixtureId: match.fixtureId,
    sportSlug: match.sportSlug,
  };
}

export async function listRuntimeMatches(
  tournamentId: number,
): Promise<RuntimeMatchListItem[]> {
  const rows = await listMatchRows(tournamentId);
  return rows.map((r) => mapRowToRuntimeListItem(toBridgeRow(r)));
}

export function buildRuntimeIdentity(
  match: typeof scoringMatchesTable.$inferSelect,
): MatchIdentity {
  return mapRowToRuntimeIdentity(toBridgeRow(match));
}

export function buildExecutionPhaseState(
  match: typeof scoringMatchesTable.$inferSelect,
): ExecutionPhaseState {
  return mapRowToExecutionPhaseState(toBridgeRow(match));
}

async function loadCompetitionStateForRuntime(
  tournamentId: number,
): Promise<CompetitionStateForRuntime | null> {
  const tournament = await loadTournamentCompetitionRow(tournamentId);
  if (!tournament) return null;
  const plan = await loadLatestPlan(tournamentId);
  const configuration = buildWorkingConfiguration(tournament, plan);
  const validation = validateCompetitionConfiguration(configuration);
  const status = buildCompetitionStatus(configuration, validation);
  return {
    competitionLocked: !!plan,
    competitionReadiness: status.readiness,
    ruleProfileId: configuration.ruleProfileId,
    ruleProfileVersion: plan?.version ?? null,
    presentationProfileId: configuration.presentationProfileId,
    presentationProfileVersion: plan?.version ?? null,
  };
}

type LinkedPlanRefs = {
  fixtureId: string | null;
  fixtureVersion: number | null;
  fixtureNodeId: string | null;
  matchBlueprintId: string | null;
  schedulingPlanId: string | null;
  schedulingVersion: number | null;
  scheduleSlotId: string | null;
  resourceAssignmentIds: { id: string; version: number | null }[];
  fixture: FixtureStateForRuntime | null;
  scheduling: SchedulingStateForRuntime | null;
};

async function resolveLinkedPlanRefs(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<LinkedPlanRefs> {
  const empty: LinkedPlanRefs = {
    fixtureId: null,
    fixtureVersion: null,
    fixtureNodeId: null,
    matchBlueprintId: null,
    schedulingPlanId: null,
    schedulingVersion: null,
    scheduleSlotId: null,
    resourceAssignmentIds: [],
    fixture: null,
    scheduling: null,
  };

  if (match.sportSlug === "badminton") {
    const [fixture] = await db
      .select()
      .from(badmintonFixturesTable)
      .where(
        and(
          eq(badmintonFixturesTable.tournamentId, match.tournamentId),
          eq(badmintonFixturesTable.scoringMatchId, match.id),
        ),
      )
      .limit(1);
    if (!fixture) return empty;

    const [draw] = await db
      .select()
      .from(badmintonDrawsTable)
      .where(
        and(
          eq(badmintonDrawsTable.tournamentId, match.tournamentId),
          eq(badmintonDrawsTable.id, fixture.drawId),
        ),
      )
      .limit(1);
    if (!draw) return empty;

    const fixtureId = encodeFixtureId("badminton", draw.id);
    const fixtureHistory = await loadLatestFixtureHistory(fixtureId);
    const schedulingHistory = await loadLatestSchedulingHistory(fixtureId);
    const fixtureLocked = !!draw.configurationLocked;
    const schedulingLocked = !!draw.schedulingConfigurationLocked;

    return {
      fixtureId,
      fixtureVersion: fixtureHistory?.version ?? null,
      fixtureNodeId: `node:bd-fixture:${fixture.id}`,
      matchBlueprintId: `blueprint:bd-fixture:${fixture.id}`,
      schedulingPlanId: fixtureId,
      schedulingVersion: schedulingHistory?.version ?? null,
      scheduleSlotId: `slot:bd-fixture:${fixture.id}`,
      resourceAssignmentIds: fixture.courtId
        ? [{ id: `court:${fixture.courtId}`, version: schedulingHistory?.version ?? null }]
        : [],
      fixture: {
        fixtureLocked,
        fixtureReady: fixtureLocked || draw.lifecycleStatus === "ready",
      },
      scheduling: {
        schedulingLocked,
        schedulingReady: schedulingLocked || draw.schedulingLifecycleStatus === "ready",
        resourceAssignmentLocked: schedulingLocked,
      },
    };
  }

  // Cricket path via scoring_fixtures
  if (match.fixtureId == null) return empty;
  const [scoringFixture] = await db
    .select()
    .from(scoringFixturesTable)
    .where(
      and(
        eq(scoringFixturesTable.tournamentId, match.tournamentId),
        eq(scoringFixturesTable.id, match.fixtureId),
      ),
    )
    .limit(1);
  if (!scoringFixture?.drawId) return empty;

  const [draw] = await db
    .select()
    .from(scoringDrawsTable)
    .where(
      and(
        eq(scoringDrawsTable.tournamentId, match.tournamentId),
        eq(scoringDrawsTable.id, scoringFixture.drawId),
      ),
    )
    .limit(1);
  if (!draw) return empty;

  const fixtureId = encodeFixtureId("cricket", draw.id);
  const fixtureHistory = await loadLatestFixtureHistory(fixtureId);
  const schedulingHistory = await loadLatestSchedulingHistory(fixtureId);
  const fixtureLocked = !!draw.configurationLocked;
  const schedulingLocked = !!draw.schedulingConfigurationLocked;

  return {
    fixtureId,
    fixtureVersion: fixtureHistory?.version ?? null,
    fixtureNodeId: `node:sf-fixture:${scoringFixture.id}`,
    matchBlueprintId: `blueprint:sf-fixture:${scoringFixture.id}`,
    schedulingPlanId: fixtureId,
    schedulingVersion: schedulingHistory?.version ?? null,
    scheduleSlotId: `slot:sf-fixture:${scoringFixture.id}`,
    resourceAssignmentIds: scoringFixture.venueId
      ? [{ id: `venue:${scoringFixture.venueId}`, version: schedulingHistory?.version ?? null }]
      : [],
    fixture: {
      fixtureLocked,
      fixtureReady: fixtureLocked || draw.lifecycleStatus === "ready",
    },
    scheduling: {
      schedulingLocked,
      schedulingReady: schedulingLocked || draw.schedulingLifecycleStatus === "ready",
      resourceAssignmentLocked: schedulingLocked,
    },
  };
}

async function buildSnapshotRefInput(
  match: typeof scoringMatchesTable.$inferSelect,
) {
  const competition = await loadCompetitionStateForRuntime(match.tournamentId);
  const plan = await loadLatestPlan(match.tournamentId);
  const matchHistory = await loadLatestMatchHistory(match.id);
  const sides = await loadMatchSides(match);
  const officials = loadMatchOfficials(match);
  const linked = await resolveLinkedPlanRefs(match);

  return {
    competition,
    linked,
    matchConfig: {
      configurationLocked: !!match.configurationLocked,
      configurationVersion: matchHistory?.version ?? null,
    } satisfies MatchConfigStateForRuntime,
    refInput: {
      matchId: String(match.id),
      ruleProfileId: competition?.ruleProfileId ?? null,
      ruleProfileVersion: competition?.ruleProfileVersion ?? null,
      presentationProfileId: competition?.presentationProfileId ?? null,
      presentationProfileVersion: competition?.presentationProfileVersion ?? null,
      competitionId: String(match.tournamentId),
      competitionVersion: plan?.version ?? null,
      fixtureId: linked.fixtureId,
      fixtureVersion: linked.fixtureVersion,
      fixtureNodeId: linked.fixtureNodeId,
      matchBlueprintId: linked.matchBlueprintId,
      schedulingPlanId: linked.schedulingPlanId,
      schedulingVersion: linked.schedulingVersion,
      scheduleSlotId: linked.scheduleSlotId,
      resourceAssignmentIds: linked.resourceAssignmentIds,
      sideIds: sides.map((s) => ({ id: s.sideId })),
      officialIds: officials.map((o, i) => ({
        id: o.participant.id || `official:${i}`,
      })),
      matchConfigurationVersion: matchHistory?.version ?? null,
    },
  };
}

export async function buildRuntimeValidation(
  tournamentId: number,
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<RuntimeValidationResult> {
  const { competition, linked, matchConfig, refInput } =
    await buildSnapshotRefInput(match);
  const refs = buildSnapshotReferences(refInput);
  const active = await loadActiveSnapshot(match);
  return validateRuntimeMatch(
    refs,
    competition,
    linked.fixture,
    linked.scheduling,
    matchConfig,
    active,
  );
}

export async function listRuntimeHistory(
  matchId: number,
): Promise<RuntimeHistoryEntry[]> {
  const rows = await db
    .select()
    .from(runtimeMatchHistoryTable)
    .where(eq(runtimeMatchHistoryTable.matchId, matchId))
    .orderBy(desc(runtimeMatchHistoryTable.createdAt));
  return rows.map((row) =>
    buildRuntimeHistoryEntry({
      matchId: String(row.matchId),
      tournamentId: row.tournamentId,
      timestamp: row.createdAt.toISOString(),
      actor: row.actor,
      operation: row.operation,
      snapshotVersion: row.snapshotVersion,
      executionPhase: row.executionPhase as ExecutionPhaseId | null,
      reason: row.reason,
      payload: row.payloadJson,
    }),
  );
}

export async function loadActiveSnapshot(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<RuntimeSnapshot | null> {
  if (match.currentRuntimeVersion == null) return null;
  const [row] = await db
    .select()
    .from(runtimeMatchHistoryTable)
    .where(
      and(
        eq(runtimeMatchHistoryTable.matchId, match.id),
        eq(runtimeMatchHistoryTable.operation, "freeze_snapshot"),
        eq(runtimeMatchHistoryTable.snapshotVersion, match.currentRuntimeVersion),
      ),
    )
    .limit(1);
  if (!row?.payloadJson) return null;
  const payload = row.payloadJson as { snapshot?: RuntimeSnapshot };
  return payload.snapshot ?? null;
}

export async function loadRuntimeContext(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<RuntimeContext | null> {
  const snapshot = await loadActiveSnapshot(match);
  if (!snapshot) return null;
  return buildRuntimeContextFromSnapshot(
    snapshot,
    (match.runtimePrepMetadataJson as Record<string, unknown> | null) ?? null,
  );
}

async function appendHistory(entry: {
  tournamentId: number;
  matchId: number;
  operation: string;
  snapshotVersion: number | null;
  executionPhase: string | null;
  actor: string | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  await db.insert(runtimeMatchHistoryTable).values({
    tournamentId: entry.tournamentId,
    matchId: entry.matchId,
    operation: entry.operation,
    snapshotVersion: entry.snapshotVersion,
    executionPhase: entry.executionPhase,
    actor: entry.actor,
    reason: entry.reason ?? null,
    payloadJson: entry.payload ?? null,
  });
}

export type PrepareRuntimeResult =
  | {
      ok: true;
      snapshot: RuntimeSnapshot;
      context: RuntimeContext;
      executionPhase: ExecutionPhaseState;
      validation: RuntimeValidationResult;
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: RuntimeValidationResult;
    };

/**
 * prepare → validation → freeze snapshot → execution phase transition.
 * Never mutates Match Lifecycle.
 */
export async function prepareRuntimeMatch(
  tournamentId: number,
  matchId: number,
  actor: string | null,
): Promise<PrepareRuntimeResult> {
  const match = await loadMatchRow(tournamentId, matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found" };

  const validation = await buildRuntimeValidation(tournamentId, match);
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Runtime Preparation has blocking validation errors",
      validation,
    };
  }

  const { refInput } = await buildSnapshotRefInput(match);
  const nextVersion = (match.currentRuntimeVersion ?? 0) + 1;
  const createdAt = new Date().toISOString();
  const snapshot = buildRuntimeSnapshot({
    matchId: String(matchId),
    tournamentId,
    snapshotVersion: nextVersion,
    createdAt,
    createdBy: actor,
    references: buildSnapshotReferences(refInput),
  });

  const lifecycle = (match.lifecycleStatus ?? "draft") as MatchLifecycleStatusId;
  let nextPhase = (match.executionPhase ?? "preparing") as ExecutionPhaseId;
  if (
    nextPhase === "preparing" ||
    !isPhaseAllowedForLifecycle(nextPhase, lifecycle)
  ) {
    nextPhase = "preparing";
  }

  await appendHistory({
    tournamentId,
    matchId,
    operation: "freeze_snapshot",
    snapshotVersion: nextVersion,
    executionPhase: nextPhase,
    actor,
    payload: buildFreezeHistoryPayload(snapshot, validation),
  });
  await appendHistory({
    tournamentId,
    matchId,
    operation: "prepare",
    snapshotVersion: nextVersion,
    executionPhase: nextPhase,
    actor,
    reason: "Runtime Preparation freeze",
  });

  const [updated] = await db
    .update(scoringMatchesTable)
    .set({
      currentRuntimeVersion: nextVersion,
      executionPhase: nextPhase,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  return {
    ok: true,
    snapshot,
    context: buildRuntimeContextFromSnapshot(snapshot, updated.runtimePrepMetadataJson),
    executionPhase: mapRowToExecutionPhaseState(toBridgeRow(updated)),
    validation,
  };
}

export type ReadyRuntimeResult =
  | {
      ok: true;
      requestedLifecycle: MatchLifecycleStatusId;
      lifecycleStatus: MatchLifecycleStatusId;
      executionPhase: ExecutionPhaseState;
      validation: RuntimeValidationResult;
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: RuntimeValidationResult;
    };

/**
 * ready → requests Match Lifecycle transition via EPIC-05 rules.
 * Runtime never invents a second lifecycle; does not jump to live.
 */
export async function requestRuntimeReady(
  tournamentId: number,
  matchId: number,
  actor: string | null,
): Promise<ReadyRuntimeResult> {
  const match = await loadMatchRow(tournamentId, matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found" };

  if (match.currentRuntimeVersion == null) {
    return {
      ok: false,
      status: 400,
      error: "Prepare Runtime Match (freeze snapshot) before Ready.",
    };
  }

  const validation = await buildRuntimeValidation(tournamentId, match);
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Runtime Ready has blocking validation errors",
      validation,
    };
  }

  const current = (match.lifecycleStatus ?? "draft") as MatchLifecycleStatusId;
  let requested: MatchLifecycleStatusId = current;
  if (current === "draft" || current === "scheduled") {
    requested = "ready";
  } else if (current === "ready") {
    requested = "locked";
  }

  const lifecycleResult = await requestMatchLifecycleTransition(
    tournamentId,
    matchId,
    requested,
  );
  if (!lifecycleResult.ok) {
    return {
      ok: false,
      status: lifecycleResult.status,
      error: lifecycleResult.error,
    };
  }

  const updated = await loadMatchRow(tournamentId, matchId);
  if (!updated) return { ok: false, status: 404, error: "Match not found" };

  await appendHistory({
    tournamentId,
    matchId,
    operation: "ready_request",
    snapshotVersion: match.currentRuntimeVersion,
    executionPhase: updated.executionPhase,
    actor,
    reason: `Requested Match Lifecycle ${lifecycleResult.from} → ${lifecycleResult.to}`,
    payload: {
      from: lifecycleResult.from,
      to: lifecycleResult.to,
      authority: "epic-05-match-lifecycle",
    },
  });

  return {
    ok: true,
    requestedLifecycle: requested,
    lifecycleStatus: lifecycleResult.lifecycle.status,
    executionPhase: mapRowToExecutionPhaseState(toBridgeRow(updated)),
    validation,
  };
}

export type PhaseTransitionResult =
  | { ok: true; executionPhase: ExecutionPhaseState }
  | { ok: false; status: number; error: string };

/** Advance Execution Phase linearly — subordinate to Match Lifecycle. */
export async function transitionExecutionPhase(
  tournamentId: number,
  matchId: number,
  toPhase: ExecutionPhaseId,
  actor: string | null,
  reason?: string | null,
): Promise<PhaseTransitionResult> {
  const match = await loadMatchRow(tournamentId, matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found" };

  const from = (match.executionPhase ?? "preparing") as ExecutionPhaseId;
  if (!isValidExecutionPhaseTransition(from, toPhase)) {
    return {
      ok: false,
      status: 409,
      error: `Invalid Execution Phase transition ${from} → ${toPhase}.`,
    };
  }

  const lifecycle = (match.lifecycleStatus ?? "draft") as MatchLifecycleStatusId;
  if (!isPhaseAllowedForLifecycle(toPhase, lifecycle)) {
    return {
      ok: false,
      status: 409,
      error: `Execution Phase "${toPhase}" is not allowed while Match Lifecycle is "${lifecycle}".`,
    };
  }

  const [updated] = await db
    .update(scoringMatchesTable)
    .set({ executionPhase: toPhase, updatedAt: new Date() })
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  await appendHistory({
    tournamentId,
    matchId,
    operation: "phase_transition",
    snapshotVersion: match.currentRuntimeVersion,
    executionPhase: toPhase,
    actor,
    reason: reason ?? `${from} → ${toPhase}`,
  });

  return { ok: true, executionPhase: mapRowToExecutionPhaseState(toBridgeRow(updated)) };
}
