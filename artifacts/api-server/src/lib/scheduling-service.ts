import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  badmintonCourtsTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  db,
  schedulingConfigurationHistoryTable,
  scoringDrawsTable,
  scoringFixturesTable,
  scoringVenuesTable,
} from "@workspace/db";
import {
  buildCompetitionStatus,
  validateCompetitionConfiguration,
} from "@workspace/platform-core/competition";
import {
  buildSchedulingConfigurationHistoryPayload,
  lifecycleAfterSchedulingLock,
  mapBadmintonCourtsToResourceRefs,
  mapBadmintonFixturesToSchedule,
  mapDrawToSchedulingConfiguration,
  mapDrawToSchedulingIdentity,
  mapDrawToSchedulingLifecycle,
  mapScoringFixturesToSchedule,
  mapScoringVenuesToResourceRefs,
  mergeSchedulingConfigBlob,
  parseSchedulingId,
  validateScheduling,
  type ResourceAssignment,
  type ScheduleSlot,
  type SchedulingConfiguration,
  type SchedulingConfigurationHistoryEntry,
  type SchedulingConfigurationHistoryPayload,
  type SchedulingIdentity,
  type SchedulingLifecycle,
  type SchedulingLifecycleStatusId,
  type SchedulingResourceRef,
  type SchedulingValidationResult,
} from "@workspace/platform-core/scheduling";
import {
  buildWorkingConfiguration,
  loadLatestPlan,
  loadTournamentCompetitionRow,
} from "./competition-service";

function checksumPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toDrawRuntime(
  source: "badminton" | "cricket",
  row: {
    id: number;
    tournamentId: number;
    schedulingStrategyId?: string | null;
    schedulingLifecycleStatus?: string | null;
    schedulingConfigurationLocked?: boolean | null;
    metaJson?: Record<string, unknown> | null;
    configJson?: unknown;
  },
) {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    source,
    schedulingStrategyId: row.schedulingStrategyId,
    schedulingLifecycleStatus: row.schedulingLifecycleStatus,
    schedulingConfigurationLocked: row.schedulingConfigurationLocked,
    metaOrConfigJson:
      source === "badminton"
        ? (row.metaJson ?? null)
        : ((row.configJson as Record<string, unknown> | null) ?? null),
  };
}

export async function loadCompetitionStateForScheduling(tournamentId: number) {
  const tournament = await loadTournamentCompetitionRow(tournamentId);
  if (!tournament) return null;
  const plan = await loadLatestPlan(tournamentId);
  const configuration = buildWorkingConfiguration(tournament, plan);
  const validation = validateCompetitionConfiguration(configuration);
  const status = buildCompetitionStatus(configuration, validation);
  return {
    competitionLocked: !!plan,
    competitionReadiness: status.readiness,
  };
}

async function loadFixtureStateForScheduling(
  source: "badminton" | "cricket",
  draw: { configurationLocked?: boolean | null; lifecycleStatus?: string | null },
) {
  const locked = !!draw.configurationLocked;
  const status = draw.lifecycleStatus ?? null;
  return {
    fixtureLocked: locked,
    fixtureReady: locked || status === "ready",
    fixtureReadiness: locked ? ("ready" as const) : ("not_ready" as const),
  };
}

export async function listSchedulingIdentities(
  tournamentId: number,
): Promise<SchedulingIdentity[]> {
  const [badmintonRows, scoringRows] = await Promise.all([
    db
      .select()
      .from(badmintonDrawsTable)
      .where(eq(badmintonDrawsTable.tournamentId, tournamentId)),
    db
      .select()
      .from(scoringDrawsTable)
      .where(eq(scoringDrawsTable.tournamentId, tournamentId)),
  ]);
  return [
    ...badmintonRows.map((r) =>
      mapDrawToSchedulingIdentity(toDrawRuntime("badminton", r), r.fixtureTypeId),
    ),
    ...scoringRows.map((r) =>
      mapDrawToSchedulingIdentity(toDrawRuntime("cricket", r), r.fixtureTypeId),
    ),
  ];
}

async function loadBadmintonDraw(tournamentId: number, drawId: number) {
  const [row] = await db
    .select()
    .from(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.tournamentId, tournamentId),
        eq(badmintonDrawsTable.id, drawId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function loadScoringDraw(tournamentId: number, drawId: number) {
  const [row] = await db
    .select()
    .from(scoringDrawsTable)
    .where(
      and(
        eq(scoringDrawsTable.tournamentId, tournamentId),
        eq(scoringDrawsTable.id, drawId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function loadLatestSchedulingHistory(
  schedulingKey: string,
): Promise<SchedulingConfigurationHistoryEntry | null> {
  const [row] = await db
    .select()
    .from(schedulingConfigurationHistoryTable)
    .where(eq(schedulingConfigurationHistoryTable.schedulingKey, schedulingKey))
    .orderBy(desc(schedulingConfigurationHistoryTable.version))
    .limit(1);
  if (!row) return null;
  return {
    schedulingId: row.schedulingKey,
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as SchedulingConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  };
}

export async function listSchedulingHistory(
  schedulingKey: string,
): Promise<SchedulingConfigurationHistoryEntry[]> {
  const rows = await db
    .select()
    .from(schedulingConfigurationHistoryTable)
    .where(eq(schedulingConfigurationHistoryTable.schedulingKey, schedulingKey))
    .orderBy(desc(schedulingConfigurationHistoryTable.version));
  return rows.map((row) => ({
    schedulingId: row.schedulingKey,
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as SchedulingConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  }));
}

/** Same date/time on the same resource = conflict. Parallel different resources is OK. */
function countSlotConflicts(
  slots: readonly ScheduleSlot[],
  assignments: readonly ResourceAssignment[],
): number {
  const resourceBySlot = new Map(assignments.map((a) => [a.slotId, a.resourceId]));
  let conflicts = 0;
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    if (!a?.date || !a.startTime) continue;
    const resourceA = resourceBySlot.get(a.slotId);
    if (!resourceA) continue;
    for (let j = i + 1; j < slots.length; j++) {
      const b = slots[j];
      if (!b?.date || !b.startTime) continue;
      const resourceB = resourceBySlot.get(b.slotId);
      if (!resourceB) continue;
      if (a.date === b.date && a.startTime === b.startTime && resourceA === resourceB) {
        conflicts++;
      }
    }
  }
  return conflicts;
}

export type ResolvedScheduling = {
  identity: SchedulingIdentity;
  configuration: SchedulingConfiguration;
  lifecycle: SchedulingLifecycle;
  slots: ScheduleSlot[];
  assignments: ResourceAssignment[];
  resources: SchedulingResourceRef[];
  locked: boolean;
};

export async function resolveScheduling(
  tournamentId: number,
  schedulingId: string,
): Promise<ResolvedScheduling | null> {
  const parsed = parseSchedulingId(schedulingId);
  if (!parsed) return null;
  const history = await loadLatestSchedulingHistory(schedulingId);

  if (parsed.source === "badminton") {
    const draw = await loadBadmintonDraw(tournamentId, parsed.runtimeId);
    if (!draw) return null;
    const [fixtures, courts] = await Promise.all([
      db
        .select()
        .from(badmintonFixturesTable)
        .where(eq(badmintonFixturesTable.drawId, draw.id))
        .orderBy(badmintonFixturesTable.id),
      db
        .select()
        .from(badmintonCourtsTable)
        .where(eq(badmintonCourtsTable.tournamentId, tournamentId)),
    ]);
    const runtime = toDrawRuntime("badminton", draw);
    const { slots, assignments } = mapBadmintonFixturesToSchedule(fixtures, courts);
    return {
      identity: mapDrawToSchedulingIdentity(runtime, draw.fixtureTypeId),
      configuration: mapDrawToSchedulingConfiguration(runtime, {
        planVersion: history?.version ?? null,
      }),
      lifecycle: mapDrawToSchedulingLifecycle(runtime, slots.length > 0),
      slots,
      assignments,
      resources: mapBadmintonCourtsToResourceRefs(courts),
      locked: !!draw.schedulingConfigurationLocked,
    };
  }

  const draw = await loadScoringDraw(tournamentId, parsed.runtimeId);
  if (!draw) return null;
  const [fixtures, venues] = await Promise.all([
    db
      .select()
      .from(scoringFixturesTable)
      .where(eq(scoringFixturesTable.drawId, draw.id))
      .orderBy(scoringFixturesTable.id),
    db
      .select()
      .from(scoringVenuesTable)
      .where(eq(scoringVenuesTable.tournamentId, tournamentId)),
  ]);
  const runtime = toDrawRuntime("cricket", draw);
  const { slots, assignments } = mapScoringFixturesToSchedule(fixtures, venues);
  return {
    identity: mapDrawToSchedulingIdentity(runtime, draw.fixtureTypeId),
    configuration: mapDrawToSchedulingConfiguration(runtime, {
      planVersion: history?.version ?? null,
    }),
    lifecycle: mapDrawToSchedulingLifecycle(runtime, slots.length > 0),
    slots,
    assignments,
    resources: mapScoringVenuesToResourceRefs(venues),
    locked: !!draw.schedulingConfigurationLocked,
  };
}

export async function buildSchedulingValidation(
  tournamentId: number,
  schedulingId: string,
): Promise<SchedulingValidationResult | null> {
  const resolved = await resolveScheduling(tournamentId, schedulingId);
  if (!resolved) return null;
  const parsed = parseSchedulingId(schedulingId);
  if (!parsed) return null;

  const competition = await loadCompetitionStateForScheduling(tournamentId);
  let fixtureState = null;
  if (parsed.source === "badminton") {
    const draw = await loadBadmintonDraw(tournamentId, parsed.runtimeId);
    if (draw) fixtureState = await loadFixtureStateForScheduling("badminton", draw);
  } else {
    const draw = await loadScoringDraw(tournamentId, parsed.runtimeId);
    if (draw) fixtureState = await loadFixtureStateForScheduling("cricket", draw);
  }

  // Product-level conflict signal only — algorithms stay in sport bridges/runtime.
  const conflictCount = countSlotConflicts(resolved.slots, resolved.assignments);

  return validateScheduling(
    resolved.configuration,
    resolved.slots,
    resolved.assignments,
    competition,
    fixtureState,
    { conflictCount },
  );
}

export type LockSchedulingResult =
  | {
      ok: true;
      history: SchedulingConfigurationHistoryEntry;
      validation: SchedulingValidationResult;
      configuration: SchedulingConfiguration;
      lifecycle: SchedulingLifecycle;
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: SchedulingValidationResult;
    };

export async function lockSchedulingSetup(
  tournamentId: number,
  schedulingId: string,
  frozenBy: string | null,
): Promise<LockSchedulingResult> {
  const parsed = parseSchedulingId(schedulingId);
  if (!parsed) return { ok: false, status: 400, error: "Invalid scheduling id" };

  const resolved = await resolveScheduling(tournamentId, schedulingId);
  if (!resolved) return { ok: false, status: 404, error: "Scheduling plan not found" };

  if (resolved.locked) {
    return {
      ok: false,
      status: 409,
      error: "Scheduling Setup is already locked. Re-freeze is not allowed in this epic.",
    };
  }

  const validation = await buildSchedulingValidation(tournamentId, schedulingId);
  if (!validation) return { ok: false, status: 404, error: "Scheduling plan not found" };
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Scheduling Setup has blocking validation errors",
      validation,
    };
  }

  const frozenAt = new Date().toISOString();
  const payload = buildSchedulingConfigurationHistoryPayload(
    resolved.configuration,
    resolved.slots,
    resolved.assignments,
    validation,
    frozenAt,
  );
  const checksum = checksumPayload(payload);
  const nextLifecycle = lifecycleAfterSchedulingLock(
    resolved.lifecycle.status as SchedulingLifecycleStatusId,
  );

  const [inserted] = await db
    .insert(schedulingConfigurationHistoryTable)
    .values({
      tournamentId,
      schedulingKey: schedulingId,
      source: parsed.source,
      sourceId: parsed.runtimeId,
      version: 1,
      payloadJson: payload as unknown as Record<string, unknown>,
      checksum,
      frozenBy,
    })
    .returning();

  if (parsed.source === "badminton") {
    await db
      .update(badmintonDrawsTable)
      .set({
        schedulingConfigurationLocked: true,
        schedulingLifecycleStatus: nextLifecycle,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(badmintonDrawsTable.id, parsed.runtimeId),
          eq(badmintonDrawsTable.tournamentId, tournamentId),
        ),
      );
  } else {
    await db
      .update(scoringDrawsTable)
      .set({
        schedulingConfigurationLocked: true,
        schedulingLifecycleStatus: nextLifecycle,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scoringDrawsTable.id, parsed.runtimeId),
          eq(scoringDrawsTable.tournamentId, tournamentId),
        ),
      );
  }

  const after = await resolveScheduling(tournamentId, schedulingId);
  if (!after) return { ok: false, status: 500, error: "Scheduling lock failed" };

  return {
    ok: true,
    history: {
      schedulingId,
      tournamentId,
      version: inserted.version,
      payload,
      frozenAt: inserted.createdAt.toISOString(),
      frozenBy: inserted.frozenBy,
    },
    validation,
    configuration: after.configuration,
    lifecycle: after.lifecycle,
  };
}

export async function patchSchedulingConfiguration(
  tournamentId: number,
  schedulingId: string,
  patch: {
    strategyId?: string | null;
    workingDays?: string[] | null;
    operatingHours?: { start?: string | null; end?: string | null } | null;
    bufferMinutes?: number | null;
    parallelLimit?: number | null;
    resourcePreferences?: Record<string, unknown> | null;
    breakRules?: Record<string, unknown> | null;
    venueRules?: Record<string, unknown> | null;
    customSettings?: Record<string, unknown> | null;
  },
): Promise<
  | { ok: true; configuration: SchedulingConfiguration }
  | { ok: false; status: number; error: string }
> {
  const parsed = parseSchedulingId(schedulingId);
  if (!parsed) return { ok: false, status: 400, error: "Invalid scheduling id" };

  const resolved = await resolveScheduling(tournamentId, schedulingId);
  if (!resolved) return { ok: false, status: 404, error: "Scheduling plan not found" };
  if (resolved.locked) {
    return {
      ok: false,
      status: 409,
      error: "Scheduling Setup is locked. Working Configuration cannot be edited.",
    };
  }

  const blobPatch = {
    ...(patch.strategyId !== undefined ? { strategyId: patch.strategyId } : {}),
    ...(patch.workingDays !== undefined ? { workingDays: patch.workingDays } : {}),
    ...(patch.operatingHours !== undefined
      ? { operatingHours: patch.operatingHours }
      : {}),
    ...(patch.bufferMinutes !== undefined ? { bufferMinutes: patch.bufferMinutes } : {}),
    ...(patch.parallelLimit !== undefined ? { parallelLimit: patch.parallelLimit } : {}),
    ...(patch.resourcePreferences !== undefined
      ? { resourcePreferences: patch.resourcePreferences }
      : {}),
    ...(patch.breakRules !== undefined ? { breakRules: patch.breakRules } : {}),
    ...(patch.venueRules !== undefined ? { venueRules: patch.venueRules } : {}),
    ...(patch.customSettings !== undefined
      ? { customSettings: patch.customSettings }
      : {}),
  };

  if (parsed.source === "badminton") {
    const draw = await loadBadmintonDraw(tournamentId, parsed.runtimeId);
    if (!draw) return { ok: false, status: 404, error: "Scheduling plan not found" };
    const nextMeta = mergeSchedulingConfigBlob(draw.metaJson, blobPatch);
    const [updated] = await db
      .update(badmintonDrawsTable)
      .set({
        ...(patch.strategyId !== undefined
          ? { schedulingStrategyId: patch.strategyId }
          : {}),
        metaJson: nextMeta,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(badmintonDrawsTable.id, parsed.runtimeId),
          eq(badmintonDrawsTable.tournamentId, tournamentId),
        ),
      )
      .returning();
    return {
      ok: true,
      configuration: mapDrawToSchedulingConfiguration(toDrawRuntime("badminton", updated)),
    };
  }

  const draw = await loadScoringDraw(tournamentId, parsed.runtimeId);
  if (!draw) return { ok: false, status: 404, error: "Scheduling plan not found" };
  const nextConfig = mergeSchedulingConfigBlob(
    (draw.configJson as Record<string, unknown> | null) ?? {},
    blobPatch,
  );
  const [updated] = await db
    .update(scoringDrawsTable)
    .set({
      ...(patch.strategyId !== undefined ? { schedulingStrategyId: patch.strategyId } : {}),
      configJson: nextConfig as typeof draw.configJson,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scoringDrawsTable.id, parsed.runtimeId),
        eq(scoringDrawsTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  return {
    ok: true,
    configuration: mapDrawToSchedulingConfiguration(toDrawRuntime("cricket", updated)),
  };
}
