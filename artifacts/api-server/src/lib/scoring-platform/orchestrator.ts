import { db } from "@workspace/db";
import {
  scoringDlsCalculationsTable,
  scoringMatchesTable,
  scoringSessionsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildCricketMatchSummary,
  assertExpectedSequence,
  getCurrentSequence,
  nextSequence,
  InvalidEventPayloadError,
  type ScoringEventEnvelope,
  type ScoringSportSlug,
  type CricketScoreboardState,
} from "@workspace/scoring-core";
import { and, eq, ne, sql } from "drizzle-orm";
import { broadcastScoringState } from "../scoring-broadcast";
import { ScoringPlatformError } from "./errors";
import {
  findMatchEventByCorrelationId,
  getNextEventSequence,
  loadMatchEvents,
  persistScoringEvent,
  persistScoringEventBatch,
  rowToEnvelope,
} from "./event-store";
import { getScoringAdapter, runPostMatchProjectionPipeline } from "./projections";
import { parseScoringEvent, replayScoringMatchState } from "../scoring-platform";
import { isTerminalScoringMatchStatus } from "../scoring-match-terminal";

export type ScoringActor = {
  type: "organizer" | "admin" | "scorer_pin" | "system";
  id?: string | null;
};

export type AppendSingleEventInput = {
  tournamentId: number;
  matchId: number;
  sportSlug: ScoringSportSlug;
  eventType: string;
  payload: Record<string, unknown>;
  expectedSequence: number;
  actor: ScoringActor;
  correlationId?: string | null;
  matchMeta: unknown;
};

export type AppendEventBatchInput = {
  tournamentId: number;
  matchId: number;
  sportSlug: ScoringSportSlug;
  fixtureId?: number | null;
  actor: ScoringActor;
  events: Array<{ eventType: string; payload: Record<string, unknown> }>;
  /** incremental = processEvent chain from priorState; replay = full replay after persist */
  projectionMode: "incremental" | "replay";
  priorState?: unknown;
  matchMeta: unknown;
};

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

async function persistDlsCalculation(
  matchId: number,
  tournamentId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const existing = await db
    .select({ id: scoringDlsCalculationsTable.id })
    .from(scoringDlsCalculationsTable)
    .where(eq(scoringDlsCalculationsTable.matchId, matchId));

  await db.insert(scoringDlsCalculationsTable).values({
    matchId,
    tournamentId,
    revision: existing.length + 1,
    inputsJson: payload,
    outputsJson: {
      parScore: payload.parScore,
      target: payload.target,
      revisedOvers: payload.revisedOvers,
    },
    reason: typeof payload.reason === "string" ? payload.reason : null,
  });
}

async function ensureNoOtherLiveCricketMatch(
  tournamentId: number,
  matchId: number,
): Promise<void> {
  const [otherLive] = await db
    .select({ id: scoringMatchesTable.id })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "cricket"),
        eq(scoringMatchesTable.status, "live"),
        ne(scoringMatchesTable.id, matchId),
      ),
    )
    .limit(1);

  if (otherLive) {
    throw new ScoringPlatformError(
      "Another match is already live in this tournament",
      409,
      "LIVE_MATCH_EXISTS",
    );
  }
}

type MatchProjection = {
  matchStatus: string;
  sessionStatus?: string;
  winnerTeamId?: number | null;
  resultSummary?: string | null;
  summaryJson?: Record<string, unknown> | null;
  setStartedAt?: boolean;
  setCompletedAt?: boolean;
  lastEventSeq?: number;
};

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function updateCricketMatchAndSession(
  match: typeof scoringMatchesTable.$inferSelect,
  state: unknown,
  projection: MatchProjection,
  tx: DbTx | typeof db = db,
) {
  const matchPatch: Partial<typeof scoringMatchesTable.$inferInsert> = {
    status: projection.matchStatus,
    currentProjectionVersion: projection.lastEventSeq ?? match.currentProjectionVersion,
  };

  if (projection.setStartedAt && !match.startedAt) {
    matchPatch.startedAt = new Date();
  }
  if (projection.setCompletedAt) {
    matchPatch.completedAt = new Date();
    matchPatch.winnerTeamId = projection.winnerTeamId ?? null;
    matchPatch.resultSummary = projection.resultSummary ?? null;
    matchPatch.summaryJson = projection.summaryJson ?? null;
  }

  const [updatedMatch] = await tx
    .update(scoringMatchesTable)
    .set(matchPatch)
    .where(eq(scoringMatchesTable.id, match.id))
    .returning();

  await tx
    .update(scoringSessionsTable)
    .set({
      status: projection.sessionStatus ?? "idle",
      stateJson: state as Record<string, unknown>,
      lastEventSeq: projection.lastEventSeq ?? 0,
    })
    .where(eq(scoringSessionsTable.matchId, match.id));

  return updatedMatch;
}

function publishCricketState(
  tournamentId: number,
  match: typeof scoringMatchesTable.$inferSelect,
  state: unknown,
  summary: unknown,
) {
  broadcastScoringState(tournamentId, {
    type: "scoring_state",
    matchId: match.id,
    match: {
      id: match.id,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      winnerTeamId: match.winnerTeamId,
      resultSummary: match.resultSummary,
    },
    state,
    summary,
  });
}

/**
 * Generic single-event append — cricket optimistic sequence path.
 * Event insert + match/session projection commit atomically.
 */
export async function appendSingleMatchEvent(
  input: AppendSingleEventInput,
  match: typeof scoringMatchesTable.$inferSelect,
) {
  const adapter = getScoringAdapter(input.sportSlug);
  if (!adapter.processEvent || !adapter.projectMatchFromState) {
    throw new ScoringPlatformError("Adapter does not support event append", 500, "ADAPTER_UNSUPPORTED");
  }

  const parsed = parseScoringEvent(input.sportSlug, input.eventType, input.payload);
  if (!parsed.ok) {
    throw new ScoringPlatformError(parsed.error, 400, "INVALID_PAYLOAD");
  }

  if (isTerminalScoringMatchStatus(match.status)) {
    throw new ScoringPlatformError("Match is no longer live", 409, "MATCH_CLOSED");
  }

  const adapterValidation = adapter.validateBeforeAppend?.({
    tournamentId: input.tournamentId,
    matchId: input.matchId,
    eventType: input.eventType,
    payload: parsed.payload,
    matchStatus: match.status,
  });
  if (adapterValidation && !adapterValidation.ok) {
    throw new ScoringPlatformError(adapterValidation.error, 409, adapterValidation.code);
  }

  // Idempotent replay of offline-queued events (same correlationId).
  if (input.correlationId) {
    const existing = await findMatchEventByCorrelationId(input.matchId, input.correlationId);
    if (existing) {
      const events = await loadMatchEvents(input.matchId);
      const replayedState = replayScoringMatchState(input.sportSlug, input.matchMeta, events);
      const lastSeq = events.length > 0 ? events[events.length - 1]!.sequence : 0;
      const state = {
        ...(replayedState as Record<string, unknown>),
        lastSequence: lastSeq,
      };
      const [session] = await db
        .select()
        .from(scoringSessionsTable)
        .where(eq(scoringSessionsTable.matchId, input.matchId))
        .limit(1);
      const [freshMatch] = await db
        .select()
        .from(scoringMatchesTable)
        .where(eq(scoringMatchesTable.id, input.matchId))
        .limit(1);
      return {
        event: existing,
        state: session?.stateJson ?? state,
        match: freshMatch ?? match,
        idempotentReplay: true as const,
      };
    }
  }

  if (input.eventType === CricketEventType.MATCH_STARTED) {
    await ensureNoOtherLiveCricketMatch(input.tournamentId, input.matchId);
  }

  let eventRow: ScoringEventEnvelope;
  let state: Record<string, unknown>;
  let updatedMatch: typeof scoringMatchesTable.$inferSelect;
  let projection: MatchProjection;

  try {
    const committed = await db.transaction(async (tx) => {
      // Serialize concurrent appends for this match.
      await tx.execute(
        sql`SELECT id FROM scoring_sessions WHERE match_id = ${input.matchId} FOR UPDATE`,
      );

      const [session] = await tx
        .select()
        .from(scoringSessionsTable)
        .where(eq(scoringSessionsTable.matchId, input.matchId))
        .limit(1);

      const currentSeq = getCurrentSequence(session?.lastEventSeq);
      try {
        assertExpectedSequence(input.expectedSequence, currentSeq);
      } catch {
        throw new ScoringPlatformError(
          `Sequence conflict: expected ${input.expectedSequence}, current is ${currentSeq}`,
          409,
          "SEQUENCE_CONFLICT",
        );
      }

      const events = await loadMatchEvents(input.matchId, undefined, tx);
      const currentState = replayScoringMatchState(input.sportSlug, input.matchMeta, events);
      const newSeq = nextSequence(currentSeq);

      const trialEvent: ScoringEventEnvelope = {
        matchId: input.matchId,
        tournamentId: input.tournamentId,
        fixtureId: match.fixtureId,
        sportSlug: input.sportSlug,
        eventType: input.eventType,
        eventVersion: 1,
        sequence: newSeq,
        actorType: input.actor.type as ScoringEventEnvelope["actorType"],
        actorId: input.actor.id ?? null,
        correlationId: input.correlationId ?? null,
        causationId: null,
        payload: parsed.payload,
      };

      try {
        adapter.processEvent(currentState, trialEvent, { enforceLiveRules: true });
      } catch (err) {
        if (err instanceof InvalidEventPayloadError) {
          throw new ScoringPlatformError(err.message, 400, "INVALID_PAYLOAD");
        }
        throw err;
      }

      const persisted = await persistScoringEvent(
        {
          matchId: input.matchId,
          tournamentId: input.tournamentId,
          fixtureId: match.fixtureId,
          sportSlug: input.sportSlug,
          eventType: input.eventType,
          sequence: newSeq,
          actorType: input.actor.type,
          actorId: input.actor.id,
          correlationId: input.correlationId,
          payload: parsed.payload,
        },
        tx,
      );

      const allEvents = await loadMatchEvents(input.matchId, undefined, tx);
      const replayedState = replayScoringMatchState(input.sportSlug, input.matchMeta, allEvents);
      const nextState = {
        ...(replayedState as Record<string, unknown>),
        lastSequence: newSeq,
      };
      const nextProjection = adapter.projectMatchFromState(replayedState);
      nextProjection.lastEventSeq = newSeq;

      const nextMatch = await updateCricketMatchAndSession(match, nextState, nextProjection, tx);

      return {
        eventRow: persisted,
        state: nextState,
        updatedMatch: nextMatch,
        projection: nextProjection,
      };
    });

    eventRow = committed.eventRow;
    state = committed.state;
    updatedMatch = committed.updatedMatch;
    projection = committed.projection;
  } catch (err) {
    if (err instanceof ScoringPlatformError) throw err;
    if (isUniqueViolation(err)) {
      throw new ScoringPlatformError(
        `Sequence conflict: expected ${input.expectedSequence}`,
        409,
        "SEQUENCE_CONFLICT",
      );
    }
    throw err;
  }

  const summary =
    projection.summaryJson ??
    (updatedMatch.summaryJson && typeof updatedMatch.summaryJson === "object"
      ? updatedMatch.summaryJson
      : buildCricketMatchSummary(state as CricketScoreboardState));
  publishCricketState(input.tournamentId, updatedMatch, state, summary);

  if (input.eventType === CricketEventType.DLS_APPLIED) {
    await persistDlsCalculation(input.matchId, input.tournamentId, parsed.payload);
  }

  await runPostMatchProjectionPipeline(
    input.sportSlug,
    input.tournamentId,
    input.matchId,
    projection.matchStatus,
  );

  return {
    event: eventRow,
    state,
    match: updatedMatch,
  };
}

/**
 * Generic batch append — badminton command path (no per-event sequence token).
 */
export async function appendMatchEventBatch(input: AppendEventBatchInput) {
  const adapter = getScoringAdapter(input.sportSlug);
  if (!adapter.processEvent) {
    throw new ScoringPlatformError("Adapter does not support event processing", 500, "ADAPTER_UNSUPPORTED");
  }

  const persistInputs = [];
  let seq = await getNextEventSequence(input.matchId);

  for (const event of input.events) {
    const parsed = parseScoringEvent(input.sportSlug, event.eventType, event.payload);
    if (!parsed.ok) {
      throw new ScoringPlatformError(parsed.error, 400, "INVALID_PAYLOAD");
    }
    persistInputs.push({
      matchId: input.matchId,
      tournamentId: input.tournamentId,
      fixtureId: input.fixtureId,
      sportSlug: input.sportSlug,
      eventType: event.eventType,
      sequence: seq,
      actorType: input.actor.type,
      actorId: input.actor.id,
      payload: parsed.payload,
    });
    seq += 1;
  }

  const { startSequence, envelopes } = await persistScoringEventBatch(input.matchId, persistInputs);

  let state: unknown;

  if (input.projectionMode === "incremental" && input.priorState !== undefined) {
    state = input.priorState;
    let runningSeq = startSequence;
    for (const envelope of envelopes) {
      state = adapter.processEvent(state, { ...envelope, sequence: runningSeq });
      runningSeq += 1;
    }
  } else {
    const allEvents = await loadMatchEvents(input.matchId, input.sportSlug);
    state = replayScoringMatchState(input.sportSlug, input.matchMeta, allEvents);
  }

  // Client sync uses monotonic persisted tail — effective replay tail can lag after undo tombstones.
  if (envelopes.length > 0 && state !== null && typeof state === "object") {
    const persistedTail = startSequence + envelopes.length - 1;
    state = { ...(state as Record<string, unknown>), lastSequence: persistedTail };
  }

  return { state, startSequence, envelopes };
}

// Re-export for tests that may reference row mapping through orchestrator path.
export { rowToEnvelope };
