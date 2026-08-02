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
import { eq, and, desc, asc, isNull, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { markLatency } from "./badminton-latency-trace";
import {
  scoringMatchesTable,
  scoringEventsTable,
  scoringSessionsTable,
  badmintonMatchDetailsTable,
  badmintonFixturesTable,
  badmintonAnalyticsTable,
  badmintonCategoriesTable,
  badmintonCourtsTable,
  tournamentsTable,
  type ScoringSideJson,
} from "@workspace/db";
import {
  isBadmintonTerminalMatchStatus,
  mapBadmintonStatusToFixtureStatus,
  mapBadmintonStatusToScoringMatchStatus,
} from "./badminton-match-status";
import type {
  BadmintonMatchState,
  BadmintonSide,
  BadmintonMatchStartedPayload,
  BadmintonTossCorrectedPayload,
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
  cmdCorrectToss,
  cmdDeclareRetirement,
  cmdDeclareWalkover,
  cmdDeclareDisqualification,
  cmdAssignMarginPoints,
  cmdPauseMatch,
  cmdHoldMatch,
  cmdResumeMatch,
  cmdAddMatchNote,
  cmdForceEndMatch,
  cmdReviseFinalScore,
  cmdReopenMatch,
  buildMatchReport,
  deriveIncidentLog,
  STANDARD_FORMAT,
  getUndoTargetSequences,
  parseBadmintonMatchFormat,
  BadmintonEventType,
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
  sideTeamName,
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
import { scheduleBadmintonAnalyticsRecompute, refreshBadmintonAnalyticsAfterDelete } from "./badminton-analytics";
import { scheduleBadmintonLifecycleRefresh, refreshBadmintonLifecycle } from "./badminton-lifecycle";
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
  // Select only columns needed for replay — skip metadataJson / recordedAt / fixtureId
  // to cut transfer + deserialize cost on the hot scoring path.
  const rows = await db
    .select({
      id: scoringEventsTable.id,
      matchId: scoringEventsTable.matchId,
      tournamentId: scoringEventsTable.tournamentId,
      eventType: scoringEventsTable.eventType,
      eventVersion: scoringEventsTable.eventVersion,
      sequence: scoringEventsTable.sequence,
      occurredAt: scoringEventsTable.occurredAt,
      actorType: scoringEventsTable.actorType,
      actorId: scoringEventsTable.actorId,
      correlationId: scoringEventsTable.correlationId,
      causationId: scoringEventsTable.causationId,
      payloadJson: scoringEventsTable.payloadJson,
    })
    .from(scoringEventsTable)
    .where(
      and(
        eq(scoringEventsTable.matchId, matchId),
        eq(scoringEventsTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(asc(scoringEventsTable.sequence));

  return rows.map((r) => ({
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

  // S3-08 — preserve terminal kinds (walkover/retired/DQ/abandoned), do not collapse to completed.
  const isTerminal = isBadmintonTerminalMatchStatus(state.matchStatus);

  // Keep scoring_matches.status in sync for pause/hold/reopen so court conflict checks free the court.
  if (
    !isTerminal &&
    (state.matchStatus === "live" ||
      state.matchStatus === "paused" ||
      state.matchStatus === "on_hold")
  ) {
    await db
      .update(scoringMatchesTable)
      .set({
        status: mapBadmintonStatusToScoringMatchStatus(state.matchStatus),
        completedAt: null,
        resultSummary: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );

    if (state.matchStatus === "live") {
      const fixtureId = await getMatchFixtureId(matchId, tournamentId);
      if (fixtureId) {
        await db
          .update(badmintonFixturesTable)
          .set({ status: "live", completedAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(badmintonFixturesTable.id, fixtureId),
              eq(badmintonFixturesTable.tournamentId, tournamentId),
            ),
          );
      }
    }
  }

  if (isTerminal) {
    const scoringStatus = mapBadmintonStatusToScoringMatchStatus(state.matchStatus);
    await db
      .update(scoringMatchesTable)
      .set({
        status: scoringStatus,
        winnerTeamId: null,
        resultSummary: state.resultReason ?? state.matchStatus,
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
    let leagueCategoryId: number | null = null;
    if (fixtureId) {
      const fixtureStatus = mapBadmintonStatusToFixtureStatus(state.matchStatus);
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

      const [fixtureRow] = await db
        .select({ categoryId: badmintonFixturesTable.categoryId })
        .from(badmintonFixturesTable)
        .where(
          and(
            eq(badmintonFixturesTable.id, fixtureId),
            eq(badmintonFixturesTable.tournamentId, tournamentId),
          ),
        )
        .limit(1);
      leagueCategoryId = fixtureRow?.categoryId ?? null;

      // Sprint 1 / C5 — advance winner into next-round fixture when linked.
      if (state.winnerSide === "left" || state.winnerSide === "right") {
        try {
          const { advanceKnockoutWinner } = await import("./badminton-knockout-progression");
          await advanceKnockoutWinner({
            tournamentId,
            fixtureId,
            winnerSide: state.winnerSide,
          });
        } catch (err) {
          const { KnockoutProgressionError } = await import("./badminton-knockout-progression");
          const message =
            err instanceof Error ? err.message : "Knockout advancement failed";
          console.error("[badminton] knockout advancement failed:", {
            tournamentId,
            matchId,
            fixtureId,
            winnerSide: state.winnerSide,
            message,
          });
          if (err instanceof KnockoutProgressionError) {
            state.matchNotes = [...(state.matchNotes ?? []), `[Bracket] ${message}`];
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
          }
        }
      }
    }

    scheduleBadmintonAnalyticsRecompute(tournamentId);
    scheduleBadmintonLifecycleRefresh(tournamentId);

    if (leagueCategoryId) {
      void import("./badminton-league-service")
        .then(({ rebuildCategoryPairStandings }) =>
          rebuildCategoryPairStandings(tournamentId, leagueCategoryId!),
        )
        .catch((err) => {
          console.error("[badminton] league standings rebuild failed:", err);
        });
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

    // Congratulate winning players + linked team owners (email, fire-and-forget).
    if (state.winnerSide === "left" || state.winnerSide === "right") {
      void import("./communication/badminton-match-win-email-service")
        .then(({ enqueueBadmintonMatchWinEmails }) =>
          enqueueBadmintonMatchWinEmails({ matchId, tournamentId, state }),
        )
        .catch((err) => {
          console.error("[badminton] match win email enqueue failed:", err);
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
      // Sprint 2 / S2-08 — set fixture startedAt only on first live transition.
      const [fixture] = await db
        .select({ startedAt: badmintonFixturesTable.startedAt })
        .from(badmintonFixturesTable)
        .where(
          and(
            eq(badmintonFixturesTable.id, fixtureId),
            eq(badmintonFixturesTable.tournamentId, tournamentId),
          ),
        )
        .limit(1);

      await db
        .update(badmintonFixturesTable)
        .set({
          status: "live",
          ...(fixture?.startedAt ? {} : { startedAt: new Date() }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(badmintonFixturesTable.id, fixtureId),
            eq(badmintonFixturesTable.tournamentId, tournamentId),
          ),
        );
    }

    scheduleBadmintonLifecycleRefresh(tournamentId);
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
  if (
    state.matchStatus === "live" ||
    state.matchStatus === "paused" ||
    state.matchStatus === "on_hold"
  ) {
    if (state.matchStatus === "on_hold") {
      throw new BadmintonServiceError(
        "MATCH_ON_HOLD",
        "This match is on hold. Resume it from Hold before starting scoring again.",
        409,
      );
    }
    return state;
  }

  // Pre-start hold: clear hold so start can proceed (toss preserved).
  const [dbMatch] = await db
    .select({ status: scoringMatchesTable.status })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  if (dbMatch?.status === "on_hold" && events.length === 0) {
    await db
      .update(scoringMatchesTable)
      .set({ status: "scheduled", updatedAt: new Date() })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );
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
        `Court already has a live match (#${other.id}). Put it on Hold, finish, or force-end before starting another.`,
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
  opts?: { rallyLength?: number; idempotencyKey?: string },
): Promise<BadmintonMatchState> {
  markLatency("awardPoint_enter");

  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");
  markLatency("awardPoint_meta_loaded");

  const idempotencyKey = opts?.idempotencyKey?.trim() || undefined;
  if (idempotencyKey) {
    const { findMatchEventByIdempotencyKey } = await import("./scoring-platform/event-store");
    const existing = await findMatchEventByIdempotencyKey(matchId, idempotencyKey);
    if (existing) {
      // Idempotent replay — return current authoritative state without appending.
      return loadCurrentMatchState(matchId, tournamentId, meta);
    }
  }

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

  const events = result.events.map((event) => {
    if (idempotencyKey && event.eventType === BadmintonEventType.POINT_WON) {
      return {
        ...event,
        payload: { ...event.payload, idempotencyKey },
      };
    }
    return event;
  });

  const projected = await persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    events,
    actor,
    // Prior state was just rebuilt from the full event log above. Incremental
    // project of the new events avoids a second full load+replay on every point
    // (event-loop stall that freezes all SSE displays). Undo/recovery keep "replay".
    "incremental",
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

  // Sprint 2 / S2-08 — starting a timeout without a side must not silently end one.
  if (action === "start" && !side) {
    throw new BadmintonServiceError(
      "SIDE_REQUIRED",
      "Timeout start requires side (left or right).",
      400,
    );
  }

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
  if (result.events.length === 0) {
    return state;
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

export async function handleCorrectToss(
  matchId: number,
  tournamentId: number,
  input: BadmintonTossCorrectedPayload,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdCorrectToss(state, input);
  if (!result.ok) {
    throw new BadmintonServiceError(
      "COMMAND_FAILED",
      friendlyBadmintonCommandMessage(result.error),
    );
  }

  const next = await persistBadmintonCommandEvents(
    matchId,
    tournamentId,
    meta,
    state,
    result.events,
    actor,
    "replay",
  );

  // Keep roster JSON on detail/scoring match aligned when ends are swapped.
  const leftSideJson = input.leftSide as unknown as Record<string, unknown>;
  const rightSideJson = input.rightSide as unknown as Record<string, unknown>;
  await db
    .update(badmintonMatchDetailsTable)
    .set({
      leftSideJson,
      rightSideJson,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    );
  await db
    .update(scoringMatchesTable)
    .set({
      homeSideJson: buildScoringSideFromBadmintonSide(leftSideJson),
      awaySideJson: buildScoringSideFromBadmintonSide(rightSideJson),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    );

  return next;
}

export async function handleRetirement(
  matchId: number,
  tournamentId: number,
  retiringSide: BadmintonSide,
  actor: Actor,
  reason?: string,
  assignedMarginPoints?: number,
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

  const result = cmdDeclareRetirement(state, retiringSide, reason, assignedMarginPoints);

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
  assignedMarginPoints?: number,
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

  const result = cmdDeclareWalkover(state, winningSide, reason, assignedMarginPoints);

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
  assignedMarginPoints?: number,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdDeclareDisqualification(
    state,
    disqualifiedSide,
    reason,
    assignedMarginPoints,
  );
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

/**
 * Put a match on hold so another match can use the court.
 * - scheduled (incl. after toss saved): DB status → on_hold
 * - live: engine hold (frees court; status → on_hold)
 */
export async function handleHoldMatch(
  matchId: number,
  tournamentId: number,
  actor: Actor,
  detail?: string,
): Promise<BadmintonMatchState | { status: string; matchId: number }> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

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

  if (!match) {
    throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);
  }

  if (match.status === "on_hold") {
    throw new BadmintonServiceError("ALREADY_ON_HOLD", "Match is already on hold", 409);
  }

  if (match.status === "scheduled") {
    await db
      .update(scoringMatchesTable)
      .set({ status: "on_hold", updatedAt: new Date() })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );
    return { status: "on_hold", matchId };
  }

  if (match.status === "live" || match.status === "paused") {
    const events = await loadBadmintonEvents(matchId);
    const state = replayBadmintonViaPlatform(meta, events);
    if (state.matchStatus === "paused" && state.pauseReason !== "ops_hold") {
      // Convert medical/tech pause → ops hold via resume then hold would be 2 steps;
      // allow hold from live only; if already paused non-ops, resume first is required.
      throw new BadmintonServiceError(
        "MATCH_PAUSED",
        "Resume the medical/technical pause first, then put the match on hold.",
        409,
      );
    }
    const result = cmdHoldMatch(state, detail);
    return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
  }

  throw new BadmintonServiceError(
    "INVALID_STATUS",
    "Only scheduled or live matches can be put on hold.",
    409,
  );
}

/**
 * Resume from hold:
 * - pre-start on_hold → scheduled
 * - post-start on_hold → live (engine resume)
 */
export async function handleUnholdMatch(
  matchId: number,
  tournamentId: number,
  actor: Actor,
): Promise<BadmintonMatchState | { status: string; matchId: number }> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

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

  if (!match) {
    throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament", 404);
  }

  if (match.status === "on_hold") {
    const events = await loadBadmintonEvents(matchId);
    if (events.length === 0) {
      await db
        .update(scoringMatchesTable)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(
          and(
            eq(scoringMatchesTable.id, matchId),
            eq(scoringMatchesTable.tournamentId, tournamentId),
          ),
        );
      return { status: "scheduled", matchId };
    }
    const state = replayBadmintonViaPlatform(meta, events);
    if (state.matchStatus === "on_hold" || state.pauseReason === "ops_hold" || state.isPaused) {
      const result = cmdResumeMatch(state);
      return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
    }
    // Status on_hold but engine says scheduled — clear hold flag.
    await db
      .update(scoringMatchesTable)
      .set({ status: "scheduled", updatedAt: new Date() })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );
    return { status: "scheduled", matchId };
  }

  // Engine on_hold while DB still live (legacy pause sync gap)
  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  if (state.matchStatus === "on_hold" || state.pauseReason === "ops_hold") {
    const result = cmdResumeMatch(state);
    return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
  }

  throw new BadmintonServiceError("NOT_ON_HOLD", "Match is not on hold", 409);
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

async function clearMasterStatsApplied(matchId: number, tournamentId: number): Promise<void> {
  await db
    .update(badmintonMatchDetailsTable)
    .set({ masterStatsAppliedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    );
}

export async function handleReviseFinalScore(
  matchId: number,
  tournamentId: number,
  games: Array<{
    gameNumber: number;
    leftScore: number;
    rightScore: number;
    winningSide: BadmintonSide;
  }>,
  winningSide: BadmintonSide,
  actor: Actor,
  note?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdReviseFinalScore(state, games, winningSide, note);
  await clearMasterStatsApplied(matchId, tournamentId);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function handleReopenMatch(
  matchId: number,
  tournamentId: number,
  actor: Actor,
  note?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdReopenMatch(state, note);
  await clearMasterStatsApplied(matchId, tournamentId);
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
  assignedMarginPoints?: number,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdForceEndMatch(state, reason, assignedMarginPoints);
  return persistCommandResult(matchId, tournamentId, meta, state, result, actor);
}

export async function handleAssignMarginPoints(
  matchId: number,
  tournamentId: number,
  assignedMarginPoints: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonViaPlatform(meta, events);
  const result = cmdAssignMarginPoints(state, assignedMarginPoints);
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

/** @deprecated Plaintext match/court PINs are no longer generated or written (S3-10). */
export function generateMatchScorerPin(): string {
  return String(randomInt(1000, 10_000));
}

const SCORER_PIN_DEPRECATED_MSG =
  "Match/court scorer PIN writes are deprecated. Scorers sign in with mobile and personal PIN. Omit scorerPin or send null to clear a legacy code.";

/** Reject non-empty plaintext PIN writes; allow omit / null / blank to clear. */
function resolveDeprecatedScorerPinWrite(
  scorerPin: string | null | undefined,
): string | null | undefined {
  if (scorerPin === undefined) return undefined;
  if (scorerPin == null) return null;
  const trimmed = scorerPin.trim();
  if (trimmed.length === 0) return null;
  throw new BadmintonServiceError("SCORER_PIN_DEPRECATED", SCORER_PIN_DEPRECATED_MSG, 400);
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

  const snapshotStatus =
    typeof snapshot?.matchStatus === "string" ? snapshot.matchStatus.trim() : "";
  const tableStatus = typeof match.status === "string" ? match.status.trim() : "";
  // Prefer any terminal status so Scorer Home never shows Resume after a finish.
  const matchStatus =
    (isBadmintonTerminalMatchStatus(snapshotStatus) ? snapshotStatus : null) ||
    (isBadmintonTerminalMatchStatus(tableStatus) ? tableStatus : null) ||
    snapshotStatus ||
    tableStatus ||
    "scheduled";
  const ui = mapMatchStatusToScorerHomeUi(matchStatus);

  const category =
    (categoryCode && categoryCode.trim()) ||
    (categoryName && categoryName.trim()) ||
    (detail.roundName?.trim() ? detail.roundName.trim() : null) ||
    (detail.matchLabel?.trim() ? detail.matchLabel.trim() : null);

  const leftSide = leftFromState ?? (detail.leftSideJson as Record<string, unknown> | null);
  const rightSide = rightFromState ?? (detail.rightSideJson as Record<string, unknown> | null);

  const matchNumber =
    typeof detail.matchNumber === "string" && detail.matchNumber.trim()
      ? detail.matchNumber.trim()
      : null;

  return {
    id: match.id,
    matchNumber,
    category,
    playerA: sideDisplayLabel(leftSide),
    playerB: sideDisplayLabel(rightSide),
    teamA: sideTeamName(leftSide),
    teamB: sideTeamName(rightSide),
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
  const fixtureIds = [
    ...new Set(
      (rows as MatchRow[])
        .map((r) => r.detail?.fixtureId ?? r.match.fixtureId)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const fixtureSlots =
    fixtureIds.length > 0
      ? await db
          .select({
            id: badmintonFixturesTable.id,
            slotNumber: badmintonFixturesTable.slotNumber,
          })
          .from(badmintonFixturesTable)
          .where(
            and(
              eq(badmintonFixturesTable.tournamentId, tournamentId),
              inArray(badmintonFixturesTable.id, fixtureIds),
            ),
          )
      : [];

  const slotByFixtureId = new Map<number, number | null>();
  for (const f of fixtureSlots) {
    slotByFixtureId.set(f.id, f.slotNumber ?? null);
  }

  return (rows as MatchRow[]).map(({ match, detail }) => {
    const fixtureId = detail?.fixtureId ?? match.fixtureId ?? null;
    const fixtureSlotNumber =
      fixtureId != null ? (slotByFixtureId.get(fixtureId) ?? null) : null;
    return {
      ...match,
      detail: detail
        ? {
            ...detail,
            fixtureSlotNumber,
          }
        : null,
      state: detail?.stateSnapshotJson ?? null,
    };
  });
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
  scorerPin?: string | null;
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

  // S3-10 — never auto-generate or persist new plaintext match PINs.
  const scorerPin = resolveDeprecatedScorerPinWrite(input.scorerPin) ?? null;

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
    matchNumber?: string | null;
    matchLabel?: string | null;
    roundName?: string | null;
    leftSideJson?: Record<string, unknown>;
    rightSideJson?: Record<string, unknown>;
    scorerPin?: string | null;
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
    // S3-10 — reject new plaintext PINs; blank/null clears legacy codes.
    resolveDeprecatedScorerPinWrite(input.scorerPin);
  }

  // Sprint 2 / S2-09 — live court reassignment must respect COURT_BUSY.
  if (input.courtId !== undefined && match?.status === "live" && input.courtId != null) {
    const [currentCourt] = await db
      .select({ courtId: badmintonMatchDetailsTable.courtId })
      .from(badmintonMatchDetailsTable)
      .where(
        and(
          eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
          eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);
    if (currentCourt?.courtId !== input.courtId) {
      const other = await findOtherLiveMatchOnCourt({
        tournamentId,
        courtId: input.courtId,
        excludeMatchId: matchId,
      });
      if (other) {
        throw new BadmintonServiceError(
          "COURT_BUSY",
          `Court already has a live match (#${other.id}). Finish or force-end that match before reassigning.`,
          409,
        );
      }
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
  if (input.matchNumber !== undefined) detailPatch.matchNumber = input.matchNumber;
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
    detailPatch.scorerPin = resolveDeprecatedScorerPinWrite(input.scorerPin) ?? null;
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

  if (match?.status === "live" || match?.status === "paused") {
    throw new BadmintonServiceError(
      "MATCH_LIVE",
      "Cannot delete a live match. Complete, retire, or walk over the match first.",
      409,
    );
  }

  /**
   * S3-04 — organizer-initiated delete is a hard delete inside one transaction.
   *
   * Append-only contract note: `scoring_events` are INSERT-only in normal scoring.
   * Organizer match delete intentionally forfeits forensic event history so the
   * fixture can be recreated. Soft-delete/tombstone (abandoned+hidden) is deferred
   * until a product-visible "hidden match" surface exists.
   *
   * FK follow-up (deferred): `badminton_match_details.scoring_match_id` →
   * `scoring_matches(id)` ON DELETE CASCADE — skipped here to avoid breaking
   * existing dirty/orphan rows; integrity is enforced by this transaction instead
   * (details deleted before/with the match; no orphan match_details).
   */
  await db.transaction(async (tx) => {
    // Restore fixture to scheduled (court/time kept) so operators can recreate the match.
    await tx
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

    await tx
      .update(badmintonAnalyticsTable)
      .set({ longestRallyMatchId: null, updatedAt: new Date() })
      .where(
        and(
          eq(badmintonAnalyticsTable.tournamentId, tournamentId),
          eq(badmintonAnalyticsTable.longestRallyMatchId, matchId),
        ),
      );

    // Child rows first — prevents orphan match_details / dangling sessions/events.
    await tx
      .delete(scoringSessionsTable)
      .where(eq(scoringSessionsTable.matchId, matchId));

    await tx
      .delete(scoringEventsTable)
      .where(
        and(
          eq(scoringEventsTable.matchId, matchId),
          eq(scoringEventsTable.tournamentId, tournamentId),
        ),
      );

    await tx
      .delete(badmintonMatchDetailsTable)
      .where(
        and(
          eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
          eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
        ),
      );

    await tx
      .delete(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );
  });

  await refreshBadmintonAnalyticsAfterDelete(tournamentId);
  await refreshBadmintonLifecycle(tournamentId);
}
