import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  matchConfigurationHistoryTable,
  scoringMatchesTable,
  teamsTable,
} from "@workspace/db";
import {
  buildCompetitionStatus,
  validateCompetitionConfiguration,
} from "@workspace/platform-core/competition";
import {
  buildMatchConfigurationHistoryPayload,
  lifecycleAfterMatchLock,
  mapScoringMatchToConfiguration,
  mapScoringMatchToIdentity,
  mapScoringMatchToLifecycle,
  mapScoringMatchToOfficials,
  mapScoringMatchToSides,
  validateMatch,
  type MatchConfiguration,
  type MatchConfigurationHistoryEntry,
  type MatchConfigurationHistoryPayload,
  type MatchIdentity,
  type MatchLifecycle,
  type MatchLifecycleStatusId,
  type MatchOfficial,
  type MatchSide,
  type MatchValidationResult,
} from "@workspace/platform-core/match";
import {
  buildWorkingConfiguration,
  loadLatestPlan,
  loadTournamentCompetitionRow,
} from "./competition-service";

function checksumPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toBridgeRow(match: typeof scoringMatchesTable.$inferSelect) {
  return {
    id: match.id,
    tournamentId: match.tournamentId,
    matchLabel: match.matchLabel,
    displayName: match.displayName,
    matchTypeId: match.matchTypeId,
    venue: match.venue,
    surface: match.surface,
    scheduledAt: match.scheduledAt,
    visibility: match.visibility,
    brandingJson: match.brandingJson,
    configurationLocked: match.configurationLocked,
    lifecycleStatus: match.lifecycleStatus,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeSideJson: match.homeSideJson,
    awaySideJson: match.awaySideJson,
    officialsJson: match.officialsJson,
  };
}

export async function loadMatchRow(tournamentId: number, matchId: number) {
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.id, matchId),
      ),
    )
    .limit(1);
  return match ?? null;
}

export async function listMatchRows(tournamentId: number) {
  return db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.tournamentId, tournamentId))
    .orderBy(scoringMatchesTable.id);
}

export async function loadLatestMatchHistory(
  matchId: number,
): Promise<MatchConfigurationHistoryEntry | null> {
  const [row] = await db
    .select()
    .from(matchConfigurationHistoryTable)
    .where(eq(matchConfigurationHistoryTable.matchId, matchId))
    .orderBy(desc(matchConfigurationHistoryTable.version))
    .limit(1);
  if (!row) return null;
  return {
    matchId: String(row.matchId),
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as MatchConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  };
}

export async function listMatchHistory(
  matchId: number,
): Promise<MatchConfigurationHistoryEntry[]> {
  const rows = await db
    .select()
    .from(matchConfigurationHistoryTable)
    .where(eq(matchConfigurationHistoryTable.matchId, matchId))
    .orderBy(desc(matchConfigurationHistoryTable.version));
  return rows.map((row) => ({
    matchId: String(row.matchId),
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as MatchConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  }));
}

export function buildMatchIdentity(
  match: typeof scoringMatchesTable.$inferSelect,
): MatchIdentity {
  return mapScoringMatchToIdentity(toBridgeRow(match));
}

export function buildMatchConfiguration(
  match: typeof scoringMatchesTable.$inferSelect,
  planVersion: number | null,
): MatchConfiguration {
  return mapScoringMatchToConfiguration(toBridgeRow(match), { planVersion });
}

export function buildMatchLifecycle(
  match: typeof scoringMatchesTable.$inferSelect,
): MatchLifecycle {
  return mapScoringMatchToLifecycle(toBridgeRow(match));
}

async function teamNameMap(teamIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(teamIds.filter((id) => id > 0))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: teamsTable.id, name: teamsTable.name, displayName: teamsTable.displayName })
    .from(teamsTable)
    .where(inArray(teamsTable.id, ids));
  return new Map(
    rows.map((r) => [r.id, (r.displayName && r.displayName.trim()) || r.name]),
  );
}

export async function loadMatchSides(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<MatchSide[]> {
  const names = await teamNameMap([match.homeTeamId, match.awayTeamId]);
  return mapScoringMatchToSides(toBridgeRow(match), {
    sideA: {
      teamId: match.homeTeamId,
      teamDisplayName: names.get(match.homeTeamId) ?? match.homeSideJson?.displayName ?? null,
    },
    sideB: {
      teamId: match.awayTeamId,
      teamDisplayName: names.get(match.awayTeamId) ?? match.awaySideJson?.displayName ?? null,
    },
  });
}

export function loadMatchOfficials(
  match: typeof scoringMatchesTable.$inferSelect,
): MatchOfficial[] {
  return mapScoringMatchToOfficials(toBridgeRow(match));
}

export async function loadCompetitionStateForMatch(tournamentId: number) {
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

export async function buildMatchValidation(
  tournamentId: number,
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<MatchValidationResult> {
  const history = await loadLatestMatchHistory(match.id);
  const configuration = buildMatchConfiguration(match, history?.version ?? null);
  const sides = await loadMatchSides(match);
  const officials = loadMatchOfficials(match);
  const competition = await loadCompetitionStateForMatch(tournamentId);
  return validateMatch(configuration, sides, officials, competition);
}

export type LockMatchResult =
  | {
      ok: true;
      history: MatchConfigurationHistoryEntry;
      validation: MatchValidationResult;
      configuration: MatchConfiguration;
      lifecycle: MatchLifecycle;
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: MatchValidationResult;
    };

export async function lockMatchSetup(
  tournamentId: number,
  matchId: number,
  frozenBy: string | null,
): Promise<LockMatchResult> {
  const match = await loadMatchRow(tournamentId, matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found" };

  if (match.configurationLocked) {
    return {
      ok: false,
      status: 409,
      error: "Match Setup is already locked. Re-freeze is not allowed in this epic.",
    };
  }

  const validation = await buildMatchValidation(tournamentId, match);
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Match Setup has blocking validation errors",
      validation,
    };
  }

  const configuration = buildMatchConfiguration(match, null);
  const frozenAt = new Date().toISOString();
  const payload = buildMatchConfigurationHistoryPayload(configuration, validation, frozenAt);
  const checksum = checksumPayload(payload);
  const nextLifecycle = lifecycleAfterMatchLock(
    (match.lifecycleStatus as MatchLifecycleStatusId) ?? "draft",
  );

  const [inserted] = await db
    .insert(matchConfigurationHistoryTable)
    .values({
      tournamentId,
      matchId,
      version: 1,
      payloadJson: payload as unknown as Record<string, unknown>,
      checksum,
      frozenBy,
    })
    .returning();

  const [updated] = await db
    .update(scoringMatchesTable)
    .set({
      configurationLocked: true,
      lifecycleStatus: nextLifecycle,
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
    history: {
      matchId: String(matchId),
      tournamentId,
      version: inserted.version,
      payload,
      frozenAt: inserted.createdAt.toISOString(),
      frozenBy: inserted.frozenBy,
    },
    validation,
    configuration: buildMatchConfiguration(updated, inserted.version),
    lifecycle: buildMatchLifecycle(updated),
  };
}

function combineSchedule(
  date: string | null | undefined,
  time: string | null | undefined,
  existing: Date | null,
): Date | null | undefined {
  if (date === undefined && time === undefined) return undefined;
  const d = date !== undefined ? date : existing?.toISOString().slice(0, 10) ?? null;
  const t = time !== undefined ? time : existing ? existing.toISOString().slice(11, 16) : null;
  if (!d) return null;
  const iso = `${d}T${t && t.length >= 4 ? t : "00:00"}:00.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? existing : parsed;
}

export async function patchMatchConfiguration(
  tournamentId: number,
  matchId: number,
  patch: {
    name?: string;
    displayName?: string | null;
    typeId?: string | null;
    venue?: string | null;
    surface?: string | null;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    visibility?: string | null;
    branding?: {
      primaryColor?: string | null;
      secondaryColor?: string | null;
      logoUrl?: string | null;
    } | null;
  },
): Promise<
  | { ok: true; configuration: MatchConfiguration }
  | { ok: false; status: number; error: string }
> {
  const match = await loadMatchRow(tournamentId, matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found" };
  if (match.configurationLocked) {
    return {
      ok: false,
      status: 409,
      error: "Match Setup is locked. Working Configuration cannot be edited.",
    };
  }

  const scheduledAt = combineSchedule(
    patch.scheduledDate,
    patch.scheduledTime,
    match.scheduledAt,
  );

  const nextBranding =
    patch.branding !== undefined
      ? {
          ...(match.brandingJson ?? {}),
          ...(patch.branding ?? {}),
        }
      : undefined;

  const [updated] = await db
    .update(scoringMatchesTable)
    .set({
      ...(patch.name !== undefined ? { matchLabel: patch.name } : {}),
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.typeId !== undefined ? { matchTypeId: patch.typeId } : {}),
      ...(patch.venue !== undefined ? { venue: patch.venue } : {}),
      ...(patch.surface !== undefined ? { surface: patch.surface } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
      ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      ...(nextBranding !== undefined ? { brandingJson: nextBranding } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  return { ok: true, configuration: buildMatchConfiguration(updated, null) };
}
