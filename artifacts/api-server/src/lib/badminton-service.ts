/**
 * Badminton Scoring Service
 *
 * Tenant-isolation contract:
 * - Every public function that operates on a match MUST receive tournamentId
 *   and verify match.tournamentId === tournamentId before mutating state.
 * - No function may be called with only a matchId; callers must prove
 *   they know which tournament the match belongs to.
 */

import { randomInt } from "node:crypto";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scoringMatchesTable,
  scoringEventsTable,
  badmintonMatchDetailsTable,
  badmintonFixturesTable,
  badmintonAnalyticsTable,
  badmintonCategoriesTable,
  tournamentsTable,
  type ScoringSideJson,
} from "@workspace/db";
import type {
  BadmintonMatchState,
  BadmintonSide,
  BadmintonMatchStartedPayload,
} from "@workspace/badminton-core";
import {
  cmdAwardPoint,
  cmdUndoLastPoint,
  cmdStartMatch,
  cmdStartTimeout,
  cmdEndTimeout,
  cmdStartInterval,
  cmdEndInterval,
  cmdAcknowledgeCourtChange,
  cmdDeclareRetirement,
  cmdDeclareWalkover,
  cmdDeclareDisqualification,
  cmdPauseMatch,
  cmdResumeMatch,
  cmdAddMatchNote,
  cmdForceEndMatch,
  buildMatchReport,
  deriveIncidentLog,
  STANDARD_FORMAT,
  getUndoTargetSequences,
  parseBadmintonMatchFormat,
  type BadmintonMatchFormat,
  type MatchPauseReason,
} from "@workspace/badminton-core";
import {
  resolveInheritedFormat,
  readTournamentRulesFromSettings,
  type DrawStageKey,
} from "@workspace/api-base/tournament-rules";
import type { BadmintonEventEnvelope } from "@workspace/badminton-core";
import type { ScoringEventEnvelope } from "@workspace/scoring-core";
import { replayScoringMatchState } from "./scoring-platform";
import { appendMatchEventBatch, type ScoringActor as PlatformActor } from "./scoring-platform/orchestrator";
import { runBadmintonMasterStatisticsPipeline } from "./scoring-platform/projections";
import { ScoringPlatformError } from "./scoring-platform/errors";

// ── Errors ────────────────────────────────────────────────────────────────────

export class BadmintonServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "BadmintonServiceError";
  }
}

const BADMINTON_SPORT = "badminton" as const;

/** Replay via Scoring Platform → Badminton Adapter → Badminton Engine. */
function replayBadmintonViaPlatform(
  meta: InternalMatchMeta,
  events: BadmintonEventEnvelope[],
): BadmintonMatchState {
  return replayScoringMatchState<BadmintonMatchState>(
    BADMINTON_SPORT,
    meta,
    events as ScoringEventEnvelope[],
  );
}

/** Reject badminton mutations on non-badminton or scoring-disabled tournaments. */
export async function ensureBadmintonTournament(tournamentId: number): Promise<void> {
  const [tournament] = await db
    .select({
      sport: tournamentsTable.sport,
      scoringEnabled: tournamentsTable.scoringEnabled,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    throw new BadmintonServiceError("TOURNAMENT_NOT_FOUND", "Tournament not found", 404);
  }
  if (tournament.sport !== BADMINTON_SPORT) {
    throw new BadmintonServiceError(
      "BADMINTON_SPORT_REQUIRED",
      "Tournament sport must be badminton",
      400,
    );
  }
  if (!tournament.scoringEnabled) {
    throw new BadmintonServiceError(
      "SCORING_DISABLED",
      "Scoring is not enabled for this tournament",
      403,
    );
  }
}

/** Maps badminton left/right side payload to shared scoring_matches side JSON. */
export function buildScoringSideFromBadmintonSide(side: Record<string, unknown>): ScoringSideJson {
  const rawIds = side.playerIds;
  const playerIds = Array.isArray(rawIds)
    ? rawIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id))
    : undefined;

  const displayName =
    typeof side.label === "string"
      ? side.label
      : typeof side.shortLabel === "string"
        ? side.shortLabel
        : typeof side.displayName === "string"
          ? side.displayName
          : undefined;

  return {
    teamId: 0,
    ...(playerIds && playerIds.length > 0 ? { playerIds } : {}),
    ...(displayName ? { displayName } : {}),
  };
}

// ── Internal types ────────────────────────────────────────────────────────────

type InternalMatchMeta = {
  matchId: number;
  tournamentId: number;
  matchKind: "singles" | "doubles" | "mixed_doubles";
  format?: BadmintonMatchFormat;
};

type Actor = { type: string; id?: string | null };

/** Load tournament default BadmintonMatchFormat from scoring_settings_json. */
export async function loadTournamentBadmintonFormat(
  tournamentId: number,
): Promise<BadmintonMatchFormat | null> {
  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const rules = readTournamentRulesFromSettings(
    tournament?.scoringSettingsJson as Record<string, unknown> | null,
  );
  if (!rules || rules.sport !== "badminton") return null;
  return parseBadmintonMatchFormat(rules.format);
}

/**
 * Resolve format for a new or starting match.
 *
 * Cascade (highest first):
 *   startOverride → match → category stage → category default → tournament → STANDARD_FORMAT
 *
 * Stage keys are system-generated (Draw Generator → fixture.stageKey).
 * From fixture: pass fixture.stageKey. Manual create: optional stage or null
 * (Exhibition / Friendly — no stage layer). Organizers never invent stage keys.
 *
 * Phase 1 passes stage contribution as null; Phase 2 loads CategoryStageFormatMap
 * for `stageKey` when present and stamps match_format_json at create.
 *
 * Live matches freeze format in MATCH_STARTED — this only applies before/at start.
 */
export async function resolveBadmintonMatchFormat(input: {
  tournamentId: number;
  categoryId?: number | null;
  /**
   * System DrawStageKey from fixture (generated) or optional manual dropdown.
   * null / omitted = Exhibition / Friendly — no stage cascade layer.
   */
  stageKey?: DrawStageKey | null;
  matchFormatJson?: unknown;
  startOverride?: unknown;
}): Promise<BadmintonMatchFormat> {
  void input.stageKey; // reserved for Phase 2 category stage-map lookup
  let categoryFormat: BadmintonMatchFormat | null = null;
  if (input.categoryId) {
    const [category] = await db
      .select({ matchFormatJson: badmintonCategoriesTable.matchFormatJson })
      .from(badmintonCategoriesTable)
      .where(
        and(
          eq(badmintonCategoriesTable.id, input.categoryId),
          eq(badmintonCategoriesTable.tournamentId, input.tournamentId),
        ),
      )
      .limit(1);
    categoryFormat = parseBadmintonMatchFormat(category?.matchFormatJson) ?? null;
  }

  const tournamentFormat = await loadTournamentBadmintonFormat(input.tournamentId);
  const resolved = resolveInheritedFormat({
    tournament: tournamentFormat,
    category: categoryFormat,
    stage: null,
    match: parseBadmintonMatchFormat(input.matchFormatJson),
    startOverride: parseBadmintonMatchFormat(input.startOverride),
  });

  return resolved ?? STANDARD_FORMAT;
}

/**
 * Resolve format used when starting a match.
 * startOverride (body) wins; otherwise match → stage → category → tournament → STANDARD.
 * Once MATCH_STARTED is written, that event format is frozen for the match lifetime.
 */
export async function resolveFormatForMatchStart(
  matchId: number,
  tournamentId: number,
  startOverride?: unknown,
): Promise<BadmintonMatchFormat> {
  const [detail] = await db
    .select({
      matchFormatJson: badmintonMatchDetailsTable.matchFormatJson,
      categoryId: badmintonMatchDetailsTable.categoryId,
    })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  return resolveBadmintonMatchFormat({
    tournamentId,
    categoryId: detail?.categoryId,
    matchFormatJson: detail?.matchFormatJson,
    startOverride,
  });
}

// ── Core helpers ──────────────────────────────────────────────────────────────

export async function loadBadmintonEvents(
  matchId: number,
): Promise<BadmintonEventEnvelope[]> {
  const rows = await db
    .select()
    .from(scoringEventsTable)
    .where(
      and(
        eq(scoringEventsTable.matchId, matchId),
        eq(scoringEventsTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(asc(scoringEventsTable.sequence));

  return rows.map((r: typeof rows[0]) => ({
    id: r.id,
    matchId: r.matchId,
    tournamentId: r.tournamentId,
    sportSlug: "badminton" as const,
    eventType: r.eventType,
    eventVersion: r.eventVersion,
    sequence: r.sequence,
    occurredAt: r.occurredAt,
    actorType: r.actorType as BadmintonEventEnvelope["actorType"],
    actorId: r.actorId,
    correlationId: r.correlationId,
    causationId: r.causationId ?? undefined,
    payload: r.payloadJson as Record<string, unknown>,
  }));
}

/**
 * Load match meta AND verify it belongs to the given tournament.
 * Returns null if the match does not exist OR belongs to a different tournament.
 * This is the primary tenant-isolation guard at the service layer.
 */
export async function getMatchMeta(
  matchId: number,
  expectedTournamentId: number,
): Promise<InternalMatchMeta | null> {
  const [match] = await db
    .select({
      id: scoringMatchesTable.id,
      tournamentId: scoringMatchesTable.tournamentId,
      rulesJson: scoringMatchesTable.rulesJson,
    })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, expectedTournamentId), // <-- isolation guard
        eq(scoringMatchesTable.sportSlug, "badminton"),
      ),
    )
    .limit(1);

  if (!match) return null;

  const [detail] = await db
    .select({
      matchType: badmintonMatchDetailsTable.matchType,
      matchFormatJson: badmintonMatchDetailsTable.matchFormatJson,
      categoryId: badmintonMatchDetailsTable.categoryId,
    })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, expectedTournamentId), // <-- isolation guard
      ),
    )
    .limit(1);

  const format = await resolveBadmintonMatchFormat({
    tournamentId: expectedTournamentId,
    categoryId: detail?.categoryId,
    matchFormatJson: detail?.matchFormatJson,
  });

  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    matchKind: (detail?.matchType ?? "singles") as InternalMatchMeta["matchKind"],
    format,
  };
}

/**
 * Replay a match's events.
 * tournamentId is REQUIRED to ensure the match belongs to the caller's tenant.
 */
export async function replayMatch(
  matchId: number,
  tournamentId: number,
): Promise<BadmintonMatchState | null> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) return null;

  const events = await loadBadmintonEvents(matchId);
  const replayed = replayBadmintonViaPlatform(meta, events);
  const persistedTail = await getLastBadmintonSequence(matchId);
  if (persistedTail > 0 && replayed.lastSequence !== persistedTail) {
    return { ...replayed, lastSequence: persistedTail };
  }
  return replayed;
}

// ── Internal: sequence helpers ────────────────────────────────────────────────

async function getLastBadmintonSequence(matchId: number): Promise<number> {
  const [last] = await db
    .select({ sequence: scoringEventsTable.sequence })
    .from(scoringEventsTable)
    .where(
      and(
        eq(scoringEventsTable.matchId, matchId),
        eq(scoringEventsTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(desc(scoringEventsTable.sequence))
    .limit(1);

  return last?.sequence ?? 0;
}

async function loadCurrentMatchState(
  matchId: number,
  tournamentId: number,
  meta: InternalMatchMeta,
): Promise<BadmintonMatchState> {
  const [detail] = await db
    .select({ stateSnapshotJson: badmintonMatchDetailsTable.stateSnapshotJson })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  const snapshot = detail?.stateSnapshotJson;
  if (snapshot && typeof snapshot === "object") {
    return snapshot as BadmintonMatchState;
  }

  const events = await loadBadmintonEvents(matchId);
  return replayBadmintonViaPlatform(meta, events);
}

// ── Internal: platform event append ───────────────────────────────────────────

async function persistBadmintonCommandEvents(
  matchId: number,
  tournamentId: number,
  meta: InternalMatchMeta,
  priorState: BadmintonMatchState,
  commandEvents: Array<{ eventType: string; payload: Record<string, unknown> }>,
  actor: Actor,
  projectionMode: "incremental" | "replay",
): Promise<BadmintonMatchState> {
  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  try {
    const { state } = await appendMatchEventBatch({
      tournamentId,
      matchId,
      sportSlug: BADMINTON_SPORT,
      fixtureId,
      actor: actor as PlatformActor,
      events: commandEvents,
      projectionMode,
      priorState: projectionMode === "incremental" ? priorState : undefined,
      matchMeta: meta,
    });

    const projected = state as BadmintonMatchState;
    await updateSnapshot(matchId, tournamentId, projected);
    return projected;
  } catch (err) {
    if (err instanceof ScoringPlatformError) {
      throw new BadmintonServiceError(err.code ?? "PLATFORM_ERROR", err.message, err.status);
    }
    throw err;
  }
}

// ── Internal: snapshot update ─────────────────────────────────────────────────

async function updateSnapshot(
  matchId: number,
  tournamentId: number,
  state: BadmintonMatchState,
): Promise<void> {
  // Both update paths include tournamentId as a defensive extra guard.
  await db
    .update(badmintonMatchDetailsTable)
    .set({
      stateSnapshotJson: state as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    );

  const isTerminal =
    state.matchStatus === "completed" ||
    state.matchStatus === "walkover" ||
    state.matchStatus === "retired" ||
    state.matchStatus === "disqualified" ||
    state.matchStatus === "abandoned";

  if (isTerminal) {
    await db
      .update(scoringMatchesTable)
      .set({
        status: "completed",
        winnerTeamId: null,
        resultSummary: state.resultReason ?? "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );

    const [detail] = await db
      .select({
        leftSideJson: badmintonMatchDetailsTable.leftSideJson,
        rightSideJson: badmintonMatchDetailsTable.rightSideJson,
      })
      .from(badmintonMatchDetailsTable)
      .where(
        and(
          eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
          eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);

    if (detail?.leftSideJson && detail?.rightSideJson) {
      void runBadmintonMasterStatisticsPipeline(matchId).catch((err) => {
        console.error("[master-sports] badminton statistics pipeline failed:", err);
      });
    }
  } else if (state.matchStatus === "live") {
    await db
      .update(scoringMatchesTable)
      .set({ status: "live", startedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(scoringMatchesTable.status, "scheduled"),
        ),
      );
  }
}

// ── Internal: get fixture ID for event sourcing ───────────────────────────────

async function getMatchFixtureId(
  matchId: number,
  tournamentId: number,
): Promise<number | null> {
  const [match] = await db
    .select({ fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  return match?.fixtureId ?? null;
}

// ── Public command handlers ───────────────────────────────────────────────────

export async function startBadmintonMatch(
  matchId: number,
  tournamentId: number,
  input: BadmintonMatchStartedPayload,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdStartMatch(state, input);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "incremental",
  );
}

export async function awardPoint(
  matchId: number,
  tournamentId: number,
  winningSide: BadmintonSide,
  actor: Actor,
  opts?: { rallyLength?: number },
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const state = await loadCurrentMatchState(matchId, tournamentId, meta);
  const result = cmdAwardPoint(state, winningSide, opts);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "incremental",
  );
}

export async function undoLastPoint(
  matchId: number,
  tournamentId: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);

  const undoTargets = getUndoTargetSequences(events);
  if (undoTargets.length === 0) {
    throw new BadmintonServiceError("NO_POINTS", "No points to undo");
  }

  const result = cmdUndoLastPoint(state, undoTargets);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

export async function handleTimeout(
  matchId: number,
  tournamentId: number,
  action: "start" | "end",
  side: BadmintonSide | null,
  kind: "regular" | "medical",
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);

  const result =
    action === "start" && side
      ? cmdStartTimeout(state, side, kind)
      : cmdEndTimeout(state);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

export async function handleInterval(
  matchId: number,
  tournamentId: number,
  action: "start" | "end",
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);

  const result = action === "start" ? cmdStartInterval(state) : cmdEndInterval(state);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

export async function handleCourtChangeAck(
  matchId: number,
  tournamentId: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdAcknowledgeCourtChange(state);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

export async function handleRetirement(
  matchId: number,
  tournamentId: number,
  retiringSide: BadmintonSide,
  actor: Actor,
  reason?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdDeclareRetirement(state, retiringSide, reason);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

export async function handleWalkover(
  matchId: number,
  tournamentId: number,
  winningSide: BadmintonSide,
  actor: Actor,
  reason?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdDeclareWalkover(state, winningSide, reason);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

async function persistCommandResult(
  matchId: number,
  tournamentId: number,
  meta: InternalMatchMeta,
  state: BadmintonMatchState,
  result: { ok: true; events: Array<{ eventType: string; payload: Record<string, unknown> }> } | { ok: false; error: string },
  actor: Actor,
): Promise<BadmintonMatchState> {
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  return persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );
}

export async function handleDisqualification(
  matchId: number,
  tournamentId: number,
  disqualifiedSide: BadmintonSide,
  reason: string,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdDeclareDisqualification(state, disqualifiedSide, reason);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function handlePauseMatch(
  matchId: number,
  tournamentId: number,
  reason: MatchPauseReason,
  actor: Actor,
  detail?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdPauseMatch(state, reason, detail);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function handleResumeMatch(
  matchId: number,
  tournamentId: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdResumeMatch(state);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function handleAddMatchNote(
  matchId: number,
  tournamentId: number,
  text: string,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdAddMatchNote(state, text);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function handleForceEndMatch(
  matchId: number,
  tournamentId: number,
  reason: string,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdForceEndMatch(state, reason);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function getMatchIncidentLog(matchId: number, tournamentId: number) {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  return deriveIncidentLog(events);
}

export async function getMatchReportData(matchId: number, tournamentId: number) {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  return buildMatchReport(state, events);
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function generateMatchScorerPin(): string {
  return String(randomInt(1000, 10_000));
}

type BadmintonDetailRow = typeof badmintonMatchDetailsTable.$inferSelect;

export function serializeBadmintonMatchDetail(
  detail: BadmintonDetailRow | null,
  opts: { includeScorerPin: boolean },
): Record<string, unknown> | null {
  if (!detail) return null;
  if (opts.includeScorerPin) {
    return detail as unknown as Record<string, unknown>;
  }
  const { scorerPin: _pin, ...rest } = detail;
  return { ...rest, hasScorerPin: !!_pin };
}

export async function verifyMatchScorerPin(
  tournamentId: number,
  matchId: number,
  pin: string,
): Promise<boolean> {
  const [detail] = await db
    .select({ scorerPin: badmintonMatchDetailsTable.scorerPin })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  return !!detail?.scorerPin && detail.scorerPin === pin;
}

export async function getLiveBadmintonMatches(tournamentId: number) {
  const rows = await db
    .select({
      match: scoringMatchesTable,
      detail: badmintonMatchDetailsTable,
    })
    .from(scoringMatchesTable)
    .leftJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId), // extra isolation
      ),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(asc(scoringMatchesTable.id));

  type MatchRow = {
    match: typeof scoringMatchesTable.$inferSelect;
    detail: typeof badmintonMatchDetailsTable.$inferSelect | null;
  };
  return (rows as MatchRow[]).map(({ match, detail }) => ({
    ...match,
    detail: detail ?? null,
    state: detail?.stateSnapshotJson ?? null,
  }));
}

export async function createBadmintonMatch(input: {
  tournamentId: number;
  categoryId?: number | null;
  fixtureId?: number | null;
  courtId?: number | null;
  courtNumber?: string;
  matchNumber?: string;
  matchLabel?: string;
  roundName?: string;
  matchType: string;
  matchFormatJson?: Record<string, unknown>;
  leftSideJson: Record<string, unknown>;
  rightSideJson: Record<string, unknown>;
  scorerPin?: string;
  scorerName?: string;
  umpireName?: string;
  scheduledAt?: Date;
}) {
  await ensureBadmintonTournament(input.tournamentId);

  const scorerPin = input.scorerPin?.trim() || generateMatchScorerPin();

  const homeSideJson = buildScoringSideFromBadmintonSide(input.leftSideJson);
  const awaySideJson = buildScoringSideFromBadmintonSide(input.rightSideJson);

  // Stamp a copy of the resolved format onto the match (frozen further at MATCH_STARTED).
  const resolvedFormat = await resolveBadmintonMatchFormat({
    tournamentId: input.tournamentId,
    categoryId: input.categoryId,
    matchFormatJson: input.matchFormatJson,
  });

  const [match] = await db
    .insert(scoringMatchesTable)
    .values({
      tournamentId: input.tournamentId,
      fixtureId: input.fixtureId ?? null,
      sportSlug: "badminton",
      matchKind: "team_match",
      matchLabel: input.matchLabel ?? null,
      roundName: input.roundName ?? null,
      scheduledAt: input.scheduledAt ?? null,
      status: "scheduled",
      homeTeamId: 0,
      awayTeamId: 0,
      homeSideJson,
      awaySideJson,
      rulesJson: null,
    })
    .returning();

  const [detail] = await db.insert(badmintonMatchDetailsTable).values({
    scoringMatchId: match.id,
    tournamentId: input.tournamentId,
    categoryId: input.categoryId ?? null,
    fixtureId: input.fixtureId ?? null,
    courtId: input.courtId ?? null,
    courtNumber: input.courtNumber ?? null,
    matchNumber: input.matchNumber ?? null,
    matchLabel: input.matchLabel ?? null,
    roundName: input.roundName ?? null,
    matchType: input.matchType,
    matchFormatJson: resolvedFormat,
    leftSideJson: input.leftSideJson,
    rightSideJson: input.rightSideJson,
    scorerPin,
    scorerName: input.scorerName ?? null,
    umpireName: input.umpireName ?? null,
  }).returning();

  // Fix: include tournamentId in fixture update to prevent cross-tenant fixture linkage
  if (input.fixtureId) {
    await db
      .update(badmintonFixturesTable)
      .set({ scoringMatchId: match.id, updatedAt: new Date() })
      .where(
        and(
          eq(badmintonFixturesTable.id, input.fixtureId),
          eq(badmintonFixturesTable.tournamentId, input.tournamentId), // <-- isolation guard
        ),
      );
  }

  return { match, detail };
}

export async function updateBadmintonMatch(
  matchId: number,
  tournamentId: number,
  input: {
    matchType?: string;
    courtId?: number | null;
    courtNumber?: string | null;
    matchLabel?: string | null;
    roundName?: string | null;
    leftSideJson?: Record<string, unknown>;
    rightSideJson?: Record<string, unknown>;
    scorerPin?: string;
    umpireName?: string | null;
  },
) {
  await ensureBadmintonTournament(tournamentId);

  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) {
    throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);
  }

  const [match] = await db
    .select({ status: scoringMatchesTable.status })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  const rosterLocked = match?.status !== "scheduled";
  if (
    rosterLocked &&
    (input.matchType !== undefined ||
      input.leftSideJson !== undefined ||
      input.rightSideJson !== undefined)
  ) {
    throw new BadmintonServiceError(
      "MATCH_STARTED",
      "Cannot change players or match type after the match has started.",
      409,
    );
  }

  if (input.scorerPin !== undefined && input.scorerPin.trim().length < 4) {
    throw new BadmintonServiceError("INVALID_PIN", "Scorer PIN must be at least 4 digits", 400);
  }

  const detailPatch: Partial<typeof badmintonMatchDetailsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  const matchPatch: Partial<typeof scoringMatchesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.courtId !== undefined) detailPatch.courtId = input.courtId;
  if (input.courtNumber !== undefined) detailPatch.courtNumber = input.courtNumber;
  if (input.matchLabel !== undefined) {
    detailPatch.matchLabel = input.matchLabel;
    matchPatch.matchLabel = input.matchLabel;
  }
  if (input.roundName !== undefined) {
    detailPatch.roundName = input.roundName;
    matchPatch.roundName = input.roundName;
  }
  if (input.matchType !== undefined) detailPatch.matchType = input.matchType;
  if (input.umpireName !== undefined) detailPatch.umpireName = input.umpireName;
  if (input.scorerPin !== undefined) detailPatch.scorerPin = input.scorerPin.trim();

  if (input.leftSideJson !== undefined) {
    detailPatch.leftSideJson = input.leftSideJson;
    matchPatch.homeSideJson = buildScoringSideFromBadmintonSide(input.leftSideJson);
  }
  if (input.rightSideJson !== undefined) {
    detailPatch.rightSideJson = input.rightSideJson;
    matchPatch.awaySideJson = buildScoringSideFromBadmintonSide(input.rightSideJson);
  }

  await db
    .update(badmintonMatchDetailsTable)
    .set(detailPatch)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    );

  if (Object.keys(matchPatch).length > 1) {
    await db
      .update(scoringMatchesTable)
      .set(matchPatch)
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );
  }

  const [row] = await db
    .select({
      match: scoringMatchesTable,
      detail: badmintonMatchDetailsTable,
    })
    .from(scoringMatchesTable)
    .leftJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);
  }

  return {
    ...row.match,
    detail: row.detail ?? null,
    state: row.detail?.stateSnapshotJson ?? null,
  };
}

export async function deleteBadmintonMatch(
  matchId: number,
  tournamentId: number,
): Promise<void> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) {
    throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);
  }

  const [match] = await db
    .select({ status: scoringMatchesTable.status })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (match?.status === "live") {
    throw new BadmintonServiceError(
      "MATCH_LIVE",
      "Cannot delete a live match. Complete, retire, or walk over the match first.",
      409,
    );
  }

  await db
    .update(badmintonFixturesTable)
    .set({ scoringMatchId: null, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonFixturesTable.scoringMatchId, matchId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
      ),
    );

  await db
    .update(badmintonAnalyticsTable)
    .set({ longestRallyMatchId: null, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonAnalyticsTable.tournamentId, tournamentId),
        eq(badmintonAnalyticsTable.longestRallyMatchId, matchId),
      ),
    );

  await db
    .delete(scoringEventsTable)
    .where(
      and(
        eq(scoringEventsTable.matchId, matchId),
        eq(scoringEventsTable.tournamentId, tournamentId),
      ),
    );

  await db
    .delete(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    );

  await db
    .delete(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    );
}
