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
import { eq, and, desc, asc, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { markLatency } from "./badminton-latency-trace";
import {
  scoringMatchesTable,
  scoringEventsTable,
  badmintonMatchDetailsTable,
  badmintonFixturesTable,
  badmintonAnalyticsTable,
  badmintonCategoriesTable,
  badmintonCourtsTable,
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
import {
  mapMatchStatusToScorerHomeUi,
  sideDisplayLabel,
  pinUnlocksMatch,
  buildScorerHomeView,
  type ScorerHomeMatchCard,
  type ScorerHomeSessionPayload,
} from "./badminton-scorer-home";

export type {
  ScorerHomeMatchCard,
  ScorerHomeUiStatus,
  ScorerHomeCourtCard,
  ScorerHomeSessionPayload,
} from "./badminton-scorer-home";
export {
  mapMatchStatusToScorerHomeUi,
  pinUnlocksMatch,
  resolveEffectiveScorerPin,
  buildScorerHomeView,
  serializeBadmintonCourt,
} from "./badminton-scorer-home";
import { appendMatchEventBatch, type ScoringActor as PlatformActor } from "./scoring-platform/orchestrator";
import { runBadmintonMasterStatisticsPipeline } from "./scoring-platform/projections";
import { ScoringPlatformError } from "./scoring-platform/errors";
import {
  findOtherLiveMatchOnCourt,
  friendlyBadmintonCommandMessage,
} from "./badminton-ops";

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

/** Collect master player IDs from a side JSON (singles or doubles). */
function extractMasterIdsFromSideJson(side: Record<string, unknown>): string[] {
  const ids: string[] = [];
  if (typeof side.masterPlayerId === "string" && side.masterPlayerId.trim()) {
    ids.push(side.masterPlayerId.trim());
  }
  if (Array.isArray(side.players)) {
    for (const player of side.players) {
      if (!player || typeof player !== "object") continue;
      const masterId = (player as Record<string, unknown>).masterPlayerId;
      if (typeof masterId === "string" && masterId.trim()) {
        ids.push(masterId.trim());
      }
    }
  }
  return [...new Set(ids)];
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
 * Stage keys are system-generated (Fixture Source Adapters → fixture.stageKey).
 * From fixture: pass fixture.stageKey. Manual create (legacy): optional stage or null
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
  // Always rebuild from the event log for command priors. Snapshots can carry a
  // matching lastSequence with wrong scores (incremental project from a stale
  // prior). Trusting that made continuous scoring regress (e.g. 3-0 → 1-0).
  //
  // Pure read: no snapshot writes here. Snapshot persistence belongs on the
  // command persist path (persistBadmintonCommandEvents → updateSnapshot).
  markLatency("loadState_enter");
  const [persistedTail, events] = await Promise.all([
    getLastBadmintonSequence(matchId),
    loadBadmintonEvents(matchId),
  ]);
  markLatency("loadState_events_loaded");
  const replayed = replayBadmintonViaPlatform(meta, events);
  markLatency("loadState_replay_done");
  const authoritative =
    persistedTail > 0 && replayed.lastSequence !== persistedTail
      ? { ...replayed, lastSequence: persistedTail }
      : replayed;

  return authoritative;
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
    markLatency("persist_enter");
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
    markLatency("persist_batch_done");

    const projected = state as BadmintonMatchState;
    await updateSnapshot(matchId, tournamentId, projected);
    markLatency("persist_snapshot_done");
    return projected;
  } catch (err) {
    if (err instanceof ScoringPlatformError) {
      throw new BadmintonServiceError(err.code ?? "PLATFORM_ERROR", err.message, err.status);
    }
    // Unique (match_id, sequence) — concurrent start/score from two clients
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "23505") {
      throw new BadmintonServiceError(
        "CONCURRENT_UPDATE",
        "Another operator updated this match at the same time. Refresh Match Control and try again.",
        409,
      );
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

    const fixtureId = await getMatchFixtureId(matchId, tournamentId);
    if (fixtureId) {
      const fixtureStatus =
        state.matchStatus === "walkover" ? "walkover" : "completed";
      await db
        .update(badmintonFixturesTable)
        .set({
          status: fixtureStatus,
          completedAt: new Date(),
          resultSummary: state.resultReason ?? state.matchStatus,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(badmintonFixturesTable.id, fixtureId),
            eq(badmintonFixturesTable.tournamentId, tournamentId),
          ),
        );
    }

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

    const fixtureId = await getMatchFixtureId(matchId, tournamentId);
    if (fixtureId) {
      await db
        .update(badmintonFixturesTable)
        .set({
          status: "live",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(badmintonFixturesTable.id, fixtureId),
            eq(badmintonFixturesTable.tournamentId, tournamentId),
          ),
        );
    }
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
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);

  // Idempotent retry: match already started (network double-submit / refresh)
  if (state.matchStatus === "live" || state.matchStatus === "paused") {
    return state;
  }

  const [detail] = await db
    .select({ courtId: badmintonMatchDetailsTable.courtId })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (detail?.courtId != null) {
    const other = await findOtherLiveMatchOnCourt({
      tournamentId,
      courtId: detail.courtId,
      excludeMatchId: matchId,
    });
    if (other) {
      throw new BadmintonServiceError(
        "COURT_BUSY",
        `Court already has a live match (#${other.id}). Finish or force-end that match before starting another.`,
        409,
      );
    }
  }

  const result = cmdStartMatch(state, input);

  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  markLatency("awardPoint_enter");

  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");
  markLatency("awardPoint_meta_loaded");

  const state = await loadCurrentMatchState(matchId, tournamentId, meta);
  markLatency("awardPoint_state_loaded");

  const result = cmdAwardPoint(state, winningSide, opts);

  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }
  markLatency("awardPoint_command_ok");

  const projected = await persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    // Full replay after persist so a drifted snapshot cannot poison the next score.
    "replay",
  );
  markLatency("awardPoint_persist_done");
  return projected;
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
  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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

  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);

  if (state.matchStatus === "retired") {
    const expectedWinner: BadmintonSide = retiringSide === "left" ? "right" : "left";
    if (state.winnerSide && state.winnerSide !== expectedWinner) {
      throw new BadmintonServiceError(
        "ALREADY_TERMINAL",
        "This match is already retired with a different winner. Refresh Match Control.",
        409,
      );
    }
    return state;
  }

  const result = cmdDeclareRetirement(state, retiringSide, reason);

  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);

  if (state.matchStatus === "walkover") {
    if (state.winnerSide && state.winnerSide !== winningSide) {
      throw new BadmintonServiceError(
        "ALREADY_TERMINAL",
        "This match already has a walkover with a different winner. Refresh Match Control.",
        409,
      );
    }
    return state;
  }

  const result = cmdDeclareWalkover(state, winningSide, reason);

  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

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
  const [row] = await db
    .select({
      matchPin: badmintonMatchDetailsTable.scorerPin,
      courtId: badmintonMatchDetailsTable.courtId,
      courtPin: badmintonCourtsTable.scorerPin,
    })
    .from(badmintonMatchDetailsTable)
    .leftJoin(
      badmintonCourtsTable,
      and(
        eq(badmintonCourtsTable.id, badmintonMatchDetailsTable.courtId),
        eq(badmintonCourtsTable.tournamentId, tournamentId),
      ),
    )
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!row) return false;
  return pinUnlocksMatch({
    pin,
    matchPin: row.matchPin,
    courtPin: row.courtPin,
  }).ok;
}

function toScorerHomeMatchCard(input: {
  match: typeof scoringMatchesTable.$inferSelect;
  detail: typeof badmintonMatchDetailsTable.$inferSelect;
  categoryName: string | null;
  categoryCode: string | null;
  courtName: string | null;
  accessVia: "match_pin" | "court_pin";
}): ScorerHomeMatchCard {
  const { match, detail, categoryName, categoryCode, courtName, accessVia } = input;
  const snapshot = detail.stateSnapshotJson as Record<string, unknown> | null;
  const leftFromState =
    snapshot?.leftSide && typeof snapshot.leftSide === "object"
      ? (snapshot.leftSide as Record<string, unknown>)
      : null;
  const rightFromState =
    snapshot?.rightSide && typeof snapshot.rightSide === "object"
      ? (snapshot.rightSide as Record<string, unknown>)
      : null;

  const matchStatus =
    (typeof snapshot?.matchStatus === "string" && snapshot.matchStatus) ||
    match.status ||
    "scheduled";
  const ui = mapMatchStatusToScorerHomeUi(matchStatus);

  const category =
    (categoryCode && categoryCode.trim()) ||
    (categoryName && categoryName.trim()) ||
    (detail.roundName?.trim() ? detail.roundName.trim() : null) ||
    (detail.matchLabel?.trim() ? detail.matchLabel.trim() : null);

  return {
    id: match.id,
    category,
    playerA: sideDisplayLabel(leftFromState ?? detail.leftSideJson),
    playerB: sideDisplayLabel(rightFromState ?? detail.rightSideJson),
    court: detail.courtNumber?.trim() || courtName?.trim() || null,
    courtId: detail.courtId ?? null,
    scheduledAt: match.scheduledAt ? new Date(match.scheduledAt).toISOString() : null,
    status: ui.status,
    matchStatus,
    actionLabel: ui.actionLabel,
    readOnly: ui.readOnly,
    accessVia,
  };
}

/**
 * List matches this scorer PIN may open.
 * Resolution: Match PIN (if set) → else Court PIN → else no access.
 */
export async function listMatchesForScorerPin(
  tournamentId: number,
  pin: string,
): Promise<ScorerHomeMatchCard[]> {
  const session = await openScorerHomeSession(tournamentId, pin);
  return session.matches;
}

/**
 * Scorer Home for authenticated scorers — all tournament matches (no PIN filter).
 * Court/match PIN soft-deprecated; assignment can plug in later without changing JWT.
 */
export async function openScorerHomeForTournament(
  tournamentId: number,
): Promise<ScorerHomeSessionPayload> {
  const courts = await db
    .select({
      id: badmintonCourtsTable.id,
      name: badmintonCourtsTable.name,
      shortName: badmintonCourtsTable.shortName,
      scorerName: badmintonCourtsTable.scorerName,
    })
    .from(badmintonCourtsTable)
    .where(eq(badmintonCourtsTable.tournamentId, tournamentId))
    .orderBy(asc(badmintonCourtsTable.sortOrder), asc(badmintonCourtsTable.name));

  const rows = await db
    .select({
      match: scoringMatchesTable,
      detail: badmintonMatchDetailsTable,
      categoryName: badmintonCategoriesTable.name,
      categoryCode: badmintonCategoriesTable.code,
      courtName: badmintonCourtsTable.name,
    })
    .from(scoringMatchesTable)
    .innerJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .leftJoin(
      badmintonCategoriesTable,
      and(
        eq(badmintonCategoriesTable.id, badmintonMatchDetailsTable.categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .leftJoin(
      badmintonCourtsTable,
      and(
        eq(badmintonCourtsTable.id, badmintonMatchDetailsTable.courtId),
        eq(badmintonCourtsTable.tournamentId, tournamentId),
      ),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(asc(scoringMatchesTable.id));

  const matches: ScorerHomeMatchCard[] = rows.map((row) =>
    toScorerHomeMatchCard({
      match: row.match,
      detail: row.detail,
      categoryName: row.categoryName,
      categoryCode: row.categoryCode,
      courtName: row.courtName,
      accessVia: "court_pin",
    }),
  );

  const viewPayload = buildScorerHomeView({
    matches,
    courts: courts.map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName ?? null,
      scorerName: c.scorerName ?? null,
    })),
  });

  return {
    ok: matches.length > 0 || courts.length > 0,
    matches: viewPayload.matches,
    courts: viewPayload.courts,
    view: viewPayload.view,
  };
}

/**
 * @deprecated Court/match PIN auth removed. Use openScorerHomeForTournament.
 */
export async function openScorerHomeSession(
  tournamentId: number,
  _pin: string,
): Promise<ScorerHomeSessionPayload> {
  return openScorerHomeForTournament(tournamentId);
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
  /** Optional toss recorded at create — null clears. */
  preMatchTossJson?: Record<string, unknown> | null;
  scheduledAt?: Date;
}) {
  await ensureBadmintonTournament(input.tournamentId);

  const leftMasterIds = extractMasterIdsFromSideJson(input.leftSideJson);
  const rightMasterIds = extractMasterIdsFromSideJson(input.rightSideJson);
  if (leftMasterIds.length > 0 && rightMasterIds.length > 0) {
    const overlap = leftMasterIds.filter((id) => rightMasterIds.includes(id));
    if (overlap.length > 0) {
      throw new BadmintonServiceError(
        "SAME_PLAYERS_BOTH_SIDES",
        "Left and right sides cannot share the same player(s). Fix the fixture or match lineup.",
        400,
      );
    }
  }

  // Scorer PIN resolution for new matches:
  // - Explicit non-empty PIN → match override
  // - Explicit empty → inherit court PIN when present, else auto-generate
  // - Omitted + court has PIN → inherit (null)
  // - Otherwise auto-generate (backward compatible)
  let scorerPin: string | null;
  async function courtHasPin(courtId: number): Promise<boolean> {
    const [court] = await db
      .select({ scorerPin: badmintonCourtsTable.scorerPin })
      .from(badmintonCourtsTable)
      .where(
        and(
          eq(badmintonCourtsTable.id, courtId),
          eq(badmintonCourtsTable.tournamentId, input.tournamentId),
        ),
      )
      .limit(1);
    return !!(court?.scorerPin && court.scorerPin.trim().length >= 4);
  }

  if (input.scorerPin !== undefined) {
    const trimmed = input.scorerPin.trim();
    if (trimmed.length >= 4) {
      scorerPin = trimmed;
    } else if (input.courtId && (await courtHasPin(input.courtId))) {
      scorerPin = null;
    } else {
      scorerPin = generateMatchScorerPin();
    }
  } else if (input.courtId && (await courtHasPin(input.courtId))) {
    scorerPin = null;
  } else {
    scorerPin = generateMatchScorerPin();
  }

  const homeSideJson = buildScoringSideFromBadmintonSide(input.leftSideJson);
  const awaySideJson = buildScoringSideFromBadmintonSide(input.rightSideJson);

  // Stamp a copy of the resolved format onto the match (frozen further at MATCH_STARTED).
  const resolvedFormat = await resolveBadmintonMatchFormat({
    tournamentId: input.tournamentId,
    categoryId: input.categoryId,
    matchFormatJson: input.matchFormatJson,
  });

  return db.transaction(async (tx) => {
    const [match] = await tx
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

    const [detail] = await tx
      .insert(badmintonMatchDetailsTable)
      .values({
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
        preMatchTossJson: input.preMatchTossJson ?? null,
      })
      .returning();

    // Atomic fixture claim — only one create can win; loser rolls back inserts.
    if (input.fixtureId) {
      const [linked] = await tx
        .update(badmintonFixturesTable)
        .set({
          scoringMatchId: match.id,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(badmintonFixturesTable.id, input.fixtureId),
            eq(badmintonFixturesTable.tournamentId, input.tournamentId),
            isNull(badmintonFixturesTable.scoringMatchId),
          ),
        )
        .returning({ id: badmintonFixturesTable.id });

      if (!linked) {
        throw new BadmintonServiceError(
          "MATCH_EXISTS",
          "A match was already created for this fixture. Open Matches or Match Control.",
          409,
        );
      }
    }

    return { match, detail };
  });
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
    scorerName?: string | null;
    /** Stamp override; null clears stamp only when rebuilding — prefer resolve on create. */
    matchFormatJson?: Record<string, unknown> | null;
    preMatchTossJson?: Record<string, unknown> | null;
    scheduledAt?: Date | null;
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
      input.rightSideJson !== undefined ||
      input.preMatchTossJson !== undefined ||
      input.matchFormatJson !== undefined)
  ) {
    throw new BadmintonServiceError(
      "MATCH_STARTED",
      "Cannot change players, match type, toss, or scoring format after the match has started.",
      409,
    );
  }

  if (input.scheduledAt !== undefined && rosterLocked) {
    throw new BadmintonServiceError(
      "MATCH_STARTED",
      "Cannot delay a match after it has started.",
      409,
    );
  }

  if (input.scorerPin !== undefined) {
    const trimmed = input.scorerPin.trim();
    // Empty PIN clears match override so the court PIN is inherited.
    if (trimmed.length > 0 && trimmed.length < 4) {
      throw new BadmintonServiceError("INVALID_PIN", "Scorer PIN must be at least 4 digits", 400);
    }
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
  if (input.scorerName !== undefined) detailPatch.scorerName = input.scorerName;
  if (input.matchFormatJson !== undefined) {
    if (input.matchFormatJson === null) {
      // Re-resolve from category → tournament when clearing an override.
      const [detailRow] = await db
        .select({
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
      detailPatch.matchFormatJson = await resolveBadmintonMatchFormat({
        tournamentId,
        categoryId: detailRow?.categoryId ?? null,
      });
    } else {
      detailPatch.matchFormatJson = await resolveBadmintonMatchFormat({
        tournamentId,
        matchFormatJson: input.matchFormatJson,
      });
    }
  }
  if (input.scorerPin !== undefined) {
    const trimmed = input.scorerPin.trim();
    detailPatch.scorerPin = trimmed.length >= 4 ? trimmed : null;
  }
  if (input.scheduledAt !== undefined) matchPatch.scheduledAt = input.scheduledAt;

  if (input.leftSideJson !== undefined) {
    detailPatch.leftSideJson = input.leftSideJson;
    matchPatch.homeSideJson = buildScoringSideFromBadmintonSide(input.leftSideJson);
  }
  if (input.rightSideJson !== undefined) {
    detailPatch.rightSideJson = input.rightSideJson;
    matchPatch.awaySideJson = buildScoringSideFromBadmintonSide(input.rightSideJson);
  }
  if (input.preMatchTossJson !== undefined) {
    detailPatch.preMatchTossJson = input.preMatchTossJson;
  }

  if (input.leftSideJson !== undefined || input.rightSideJson !== undefined) {
    const [existingDetail] = await db
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
    const leftJson =
      (input.leftSideJson ?? existingDetail?.leftSideJson ?? {}) as Record<string, unknown>;
    const rightJson =
      (input.rightSideJson ?? existingDetail?.rightSideJson ?? {}) as Record<string, unknown>;
    const leftMasterIds = extractMasterIdsFromSideJson(leftJson);
    const rightMasterIds = extractMasterIdsFromSideJson(rightJson);
    if (leftMasterIds.length > 0 && rightMasterIds.length > 0) {
      const overlap = leftMasterIds.filter((id) => rightMasterIds.includes(id));
      if (overlap.length > 0) {
        throw new BadmintonServiceError(
          "SAME_PLAYERS_BOTH_SIDES",
          "Left and right sides cannot share the same player(s). Fix the fixture or match lineup.",
          400,
        );
      }
    }
  }

  // When assigning court or time on a pre-start match, both must end up set
  // (Match Control / Scorer Home require court + scheduled time to start).
  if (
    !rosterLocked &&
    (input.courtId !== undefined ||
      input.courtNumber !== undefined ||
      input.scheduledAt !== undefined)
  ) {
    const [current] = await db
      .select({
        scheduledAt: scoringMatchesTable.scheduledAt,
        courtId: badmintonMatchDetailsTable.courtId,
        courtNumber: badmintonMatchDetailsTable.courtNumber,
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

    const nextCourtId = input.courtId !== undefined ? input.courtId : (current?.courtId ?? null);
    const nextCourtNumber =
      input.courtNumber !== undefined ? input.courtNumber : (current?.courtNumber ?? null);
    const nextScheduledAt =
      input.scheduledAt !== undefined ? input.scheduledAt : (current?.scheduledAt ?? null);
    const hasCourt =
      nextCourtId != null ||
      (typeof nextCourtNumber === "string" && nextCourtNumber.trim().length > 0);

    if (!hasCourt) {
      throw new BadmintonServiceError(
        "COURT_REQUIRED",
        "Court is required. Assign a court before the match can be started.",
        400,
      );
    }
    if (!nextScheduledAt || Number.isNaN(new Date(nextScheduledAt).getTime())) {
      throw new BadmintonServiceError(
        "SCHEDULED_AT_REQUIRED",
        "Scheduled time is required. Set a date and time before the match can be started.",
        400,
      );
    }
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

  // Restore fixture to scheduled (court/time kept) so operators can recreate the match.
  await db
    .update(badmintonFixturesTable)
    .set({
      scoringMatchId: null,
      status: "scheduled",
      startedAt: null,
      completedAt: null,
      resultSummary: null,
      updatedAt: new Date(),
    })
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
