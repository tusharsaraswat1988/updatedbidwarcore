import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  badmintonDrawsTable,
  badmintonFixturesTable,
  db,
  fixtureConfigurationHistoryTable,
  scoringDrawsTable,
  scoringFixturesTable,
  scoringGroupsTable,
  teamsTable,
} from "@workspace/db";
import {
  buildCompetitionStatus,
  validateCompetitionConfiguration,
} from "@workspace/platform-core/competition";
import {
  buildFixtureAdvancementView,
  buildFixtureConfigurationHistoryPayload,
  encodeFixtureId,
  lifecycleAfterFixtureLock,
  mapBadmintonDrawToConfiguration,
  mapBadmintonDrawToIdentity,
  mapBadmintonDrawToLifecycle,
  mapBadmintonFixturesToNodes,
  mapScoringDrawToConfiguration,
  mapScoringDrawToIdentity,
  mapScoringDrawToLifecycle,
  mapScoringFixturesToNodes,
  mergeFixtureConfigBlob,
  parseFixtureId,
  validateFixture,
  type FixtureAdvancementView,
  type FixtureConfiguration,
  type FixtureConfigurationHistoryEntry,
  type FixtureConfigurationHistoryPayload,
  type FixtureIdentity,
  type FixtureLifecycle,
  type FixtureLifecycleStatusId,
  type FixtureNode,
  type FixtureValidationResult,
} from "@workspace/platform-core/fixture";
import {
  buildWorkingConfiguration,
  loadLatestPlan,
  loadTournamentCompetitionRow,
} from "./competition-service";

function checksumPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function loadCompetitionStateForFixture(tournamentId: number) {
  const tournament = await loadTournamentCompetitionRow(tournamentId);
  if (!tournament) return null;
  const plan = await loadLatestPlan(tournamentId);
  const configuration = buildWorkingConfiguration(tournament, plan);
  const validation = validateCompetitionConfiguration(configuration);
  const status = buildCompetitionStatus(configuration, validation);
  return {
    competitionLocked: !!plan,
    competitionReadiness: status.readiness,
    competitionTypeId: configuration.competitionTypeId,
    ruleProfileId: configuration.ruleProfileId,
    presentationProfileId: configuration.presentationProfileId,
  };
}

export async function listFixtureIdentities(
  tournamentId: number,
): Promise<FixtureIdentity[]> {
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
    ...badmintonRows.map(mapBadmintonDrawToIdentity),
    ...scoringRows.map(mapScoringDrawToIdentity),
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

export async function loadLatestFixtureHistory(
  fixtureKey: string,
): Promise<FixtureConfigurationHistoryEntry | null> {
  const [row] = await db
    .select()
    .from(fixtureConfigurationHistoryTable)
    .where(eq(fixtureConfigurationHistoryTable.fixtureKey, fixtureKey))
    .orderBy(desc(fixtureConfigurationHistoryTable.version))
    .limit(1);
  if (!row) return null;
  return {
    fixtureId: row.fixtureKey,
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as FixtureConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  };
}

export async function listFixtureHistory(
  fixtureKey: string,
): Promise<FixtureConfigurationHistoryEntry[]> {
  const rows = await db
    .select()
    .from(fixtureConfigurationHistoryTable)
    .where(eq(fixtureConfigurationHistoryTable.fixtureKey, fixtureKey))
    .orderBy(desc(fixtureConfigurationHistoryTable.version));
  return rows.map((row) => ({
    fixtureId: row.fixtureKey,
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as FixtureConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  }));
}

async function loadBadmintonNodes(
  drawId: number,
  competition: Awaited<ReturnType<typeof loadCompetitionStateForFixture>>,
): Promise<FixtureNode[]> {
  const fixtures = await db
    .select()
    .from(badmintonFixturesTable)
    .where(eq(badmintonFixturesTable.drawId, drawId))
    .orderBy(badmintonFixturesTable.id);
  return mapBadmintonFixturesToNodes(fixtures, {
    ruleProfileId: competition?.ruleProfileId ?? null,
    presentationProfileId: competition?.presentationProfileId ?? null,
  });
}

async function loadScoringNodes(
  drawId: number,
  competition: Awaited<ReturnType<typeof loadCompetitionStateForFixture>>,
): Promise<FixtureNode[]> {
  const fixtures = await db
    .select()
    .from(scoringFixturesTable)
    .where(eq(scoringFixturesTable.drawId, drawId))
    .orderBy(scoringFixturesTable.id);
  const teamIds = fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]).filter((id) => id > 0);
  const unique = [...new Set(teamIds)];
  const labels = new Map<number, string>();
  if (unique.length > 0) {
    const teams = await db
      .select({ id: teamsTable.id, name: teamsTable.name, displayName: teamsTable.displayName })
      .from(teamsTable)
      .where(inArray(teamsTable.id, unique));
    for (const t of teams) {
      labels.set(t.id, (t.displayName && t.displayName.trim()) || t.name);
    }
  }
  return mapScoringFixturesToNodes(fixtures, {
    teamLabels: labels,
    ruleProfileId: competition?.ruleProfileId ?? null,
    presentationProfileId: competition?.presentationProfileId ?? null,
  });
}

async function scoringGroupCount(drawId: number): Promise<number> {
  const groups = await db
    .select()
    .from(scoringGroupsTable)
    .where(eq(scoringGroupsTable.drawId, drawId));
  return groups.length;
}

export type ResolvedFixture = {
  identity: FixtureIdentity;
  configuration: FixtureConfiguration;
  lifecycle: FixtureLifecycle;
  nodes: FixtureNode[];
  locked: boolean;
};

export async function resolveFixture(
  tournamentId: number,
  fixtureId: string,
): Promise<ResolvedFixture | null> {
  const parsed = parseFixtureId(fixtureId);
  if (!parsed) return null;
  const history = await loadLatestFixtureHistory(fixtureId);
  const competition = await loadCompetitionStateForFixture(tournamentId);

  if (parsed.source === "badminton") {
    const draw = await loadBadmintonDraw(tournamentId, parsed.runtimeId);
    if (!draw) return null;
    const nodes = await loadBadmintonNodes(draw.id, competition);
    return {
      identity: mapBadmintonDrawToIdentity(draw),
      configuration: mapBadmintonDrawToConfiguration(draw, {
        planVersion: history?.version ?? null,
      }),
      lifecycle: mapBadmintonDrawToLifecycle(draw, nodes.length > 0),
      nodes,
      locked: !!draw.configurationLocked,
    };
  }

  const draw = await loadScoringDraw(tournamentId, parsed.runtimeId);
  if (!draw) return null;
  const nodes = await loadScoringNodes(draw.id, competition);
  const groupCount = await scoringGroupCount(draw.id);
  return {
    identity: mapScoringDrawToIdentity(draw),
    configuration: mapScoringDrawToConfiguration(draw, {
      planVersion: history?.version ?? null,
      groupCount,
    }),
    lifecycle: mapScoringDrawToLifecycle(draw, nodes.length > 0),
    nodes,
    locked: !!draw.configurationLocked,
  };
}

export async function buildFixtureValidation(
  tournamentId: number,
  fixtureId: string,
): Promise<FixtureValidationResult | null> {
  const resolved = await resolveFixture(tournamentId, fixtureId);
  if (!resolved) return null;
  const competition = await loadCompetitionStateForFixture(tournamentId);
  const teamRows = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));
  return validateFixture(resolved.configuration, resolved.nodes, competition, {
    teamCount: teamRows.length,
  });
}

export async function buildFixtureAdvancement(
  tournamentId: number,
  fixtureId: string,
): Promise<FixtureAdvancementView | null> {
  const resolved = await resolveFixture(tournamentId, fixtureId);
  if (!resolved) return null;
  return buildFixtureAdvancementView(fixtureId, tournamentId, resolved.nodes);
}

export type LockFixtureResult =
  | {
      ok: true;
      history: FixtureConfigurationHistoryEntry;
      validation: FixtureValidationResult;
      configuration: FixtureConfiguration;
      lifecycle: FixtureLifecycle;
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: FixtureValidationResult;
    };

export async function lockFixtureSetup(
  tournamentId: number,
  fixtureId: string,
  frozenBy: string | null,
): Promise<LockFixtureResult> {
  const parsed = parseFixtureId(fixtureId);
  if (!parsed) return { ok: false, status: 400, error: "Invalid fixture id" };

  const resolved = await resolveFixture(tournamentId, fixtureId);
  if (!resolved) return { ok: false, status: 404, error: "Fixture not found" };

  if (resolved.locked) {
    return {
      ok: false,
      status: 409,
      error: "Fixture Setup is already locked. Re-freeze is not allowed in this epic.",
    };
  }

  const validation = await buildFixtureValidation(tournamentId, fixtureId);
  if (!validation) return { ok: false, status: 404, error: "Fixture not found" };
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Fixture Setup has blocking validation errors",
      validation,
    };
  }

  const frozenAt = new Date().toISOString();
  const payload = buildFixtureConfigurationHistoryPayload(
    resolved.configuration,
    resolved.nodes,
    validation,
    frozenAt,
  );
  const checksum = checksumPayload(payload);
  const nextLifecycle = lifecycleAfterFixtureLock(
    resolved.lifecycle.status as FixtureLifecycleStatusId,
  );

  const [inserted] = await db
    .insert(fixtureConfigurationHistoryTable)
    .values({
      tournamentId,
      fixtureKey: fixtureId,
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
        configurationLocked: true,
        lifecycleStatus: nextLifecycle,
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
        configurationLocked: true,
        lifecycleStatus: nextLifecycle,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scoringDrawsTable.id, parsed.runtimeId),
          eq(scoringDrawsTable.tournamentId, tournamentId),
        ),
      );
  }

  const after = await resolveFixture(tournamentId, fixtureId);
  if (!after) return { ok: false, status: 500, error: "Fixture lock failed" };

  return {
    ok: true,
    history: {
      fixtureId,
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

export async function patchFixtureConfiguration(
  tournamentId: number,
  fixtureId: string,
  patch: {
    name?: string;
    typeId?: string | null;
    competitionFormat?: string | null;
    numberOfRounds?: number | null;
    legs?: number | null;
    groups?: number | null;
    qualificationRules?: Record<string, unknown> | null;
    thirdPlaceMatch?: boolean;
    placementRules?: Record<string, unknown> | null;
    customSettings?: Record<string, unknown> | null;
  },
): Promise<
  | { ok: true; configuration: FixtureConfiguration }
  | { ok: false; status: number; error: string }
> {
  const parsed = parseFixtureId(fixtureId);
  if (!parsed) return { ok: false, status: 400, error: "Invalid fixture id" };

  const resolved = await resolveFixture(tournamentId, fixtureId);
  if (!resolved) return { ok: false, status: 404, error: "Fixture not found" };
  if (resolved.locked) {
    return {
      ok: false,
      status: 409,
      error: "Fixture Setup is locked. Working Configuration cannot be edited.",
    };
  }

  const blobPatch = {
    ...(patch.competitionFormat !== undefined
      ? { competitionFormat: patch.competitionFormat }
      : {}),
    ...(patch.numberOfRounds !== undefined
      ? { numberOfRounds: patch.numberOfRounds }
      : {}),
    ...(patch.legs !== undefined ? { legs: patch.legs } : {}),
    ...(patch.groups !== undefined ? { groups: patch.groups } : {}),
    ...(patch.qualificationRules !== undefined
      ? { qualificationRules: patch.qualificationRules }
      : {}),
    ...(patch.thirdPlaceMatch !== undefined
      ? { thirdPlaceMatch: patch.thirdPlaceMatch }
      : {}),
    ...(patch.placementRules !== undefined
      ? { placementRules: patch.placementRules }
      : {}),
    ...(patch.customSettings !== undefined
      ? { customSettings: patch.customSettings }
      : {}),
  };

  if (parsed.source === "badminton") {
    const draw = await loadBadmintonDraw(tournamentId, parsed.runtimeId);
    if (!draw) return { ok: false, status: 404, error: "Fixture not found" };
    const nextMeta = mergeFixtureConfigBlob(draw.metaJson, blobPatch);
    const [updated] = await db
      .update(badmintonDrawsTable)
      .set({
        ...(patch.name !== undefined ? { roundName: patch.name } : {}),
        ...(patch.typeId !== undefined ? { fixtureTypeId: patch.typeId } : {}),
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
      configuration: mapBadmintonDrawToConfiguration(updated),
    };
  }

  const draw = await loadScoringDraw(tournamentId, parsed.runtimeId);
  if (!draw) return { ok: false, status: 404, error: "Fixture not found" };
  const nextConfig = mergeFixtureConfigBlob(
    (draw.configJson as Record<string, unknown> | null) ?? {},
    blobPatch,
  );
  const [updated] = await db
    .update(scoringDrawsTable)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.typeId !== undefined ? { fixtureTypeId: patch.typeId } : {}),
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
  const groupCount = await scoringGroupCount(updated.id);
  return {
    ok: true,
    configuration: mapScoringDrawToConfiguration(updated, { groupCount }),
  };
}

export { encodeFixtureId, parseFixtureId };
