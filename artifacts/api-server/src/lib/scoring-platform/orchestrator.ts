import { db } from "@workspace/db";
import {
  playersTable,
  scoringDlsCalculationsTable,
  scoringFixturesTable,
  scoringMatchesTable,
  scoringSessionsTable,
  teamsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildCricketMatchSummary,
  buildAuthoritativeCricketBroadcastEvent,
  type CricketAuthoritativeBroadcastEvent,
  assertExpectedSequence,
  getCurrentSequence,
  nextSequence,
  InvalidEventPayloadError,
  type ScoringEventEnvelope,
  type ScoringSportSlug,
  type CricketScoreboardState,
  buildMatchMetaFromRules,
  isCricketMatchTerminalState,
  deriveCricketMatchResult,
} from "@workspace/scoring-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { broadcastScoringState } from "../scoring-broadcast";
import { ScoringPlatformError } from "./errors";
import { logger } from "../logger";
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
import { assertAuthoritativeScorerLease, ScorerLockError } from "../scorer-match-locks";
import { cricketLiveSlotsConflict } from "../cricket-competition-scope";

export type ScoringActor = {
  /** 'scorer' = dedicated Empire scorer acting on a locked match. */
  type: "organizer" | "admin" | "scorer_pin" | "scorer" | "system";
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
  lease?: {
    scorerId: number;
    sessionId: string;
    leaseId?: string | null;
    leaseVersion?: number | null;
  };
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
  const liveRows = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "cricket"),
        eq(scoringMatchesTable.status, "live"),
      ),
    );

  const current = liveRows.find((match) => match.id === matchId) ?? (
    await db
      .select()
      .from(scoringMatchesTable)
      .where(eq(scoringMatchesTable.id, matchId))
      .limit(1)
  )[0];

  const others = liveRows.filter((match) => match.id !== matchId);
  if (!current || others.length === 0) return;

  const fixtureIds = [current.fixtureId, ...others.map((match) => match.fixtureId)].filter(
    (id): id is number => id != null,
  );
  const fixtures =
    fixtureIds.length === 0
      ? []
      : await db
          .select({
            id: scoringFixturesTable.id,
            drawId: scoringFixturesTable.drawId,
          })
          .from(scoringFixturesTable)
          .where(inArray(scoringFixturesTable.id, fixtureIds));
  const drawByFixture = new Map(fixtures.map((fixture) => [fixture.id, fixture.drawId]));
  const candidateDrawId =
    current.fixtureId != null ? (drawByFixture.get(current.fixtureId) ?? null) : null;

  const otherLive = others.find((match) => {
    const otherDrawId = match.fixtureId != null ? (drawByFixture.get(match.fixtureId) ?? null) : null;
    return cricketLiveSlotsConflict(candidateDrawId, otherDrawId);
  });

  if (!otherLive) return;

  const otherDrawId =
    otherLive.fixtureId != null ? (drawByFixture.get(otherLive.fixtureId) ?? null) : null;

  // Check if otherLive has already reached an authoritative terminal winning state
  const [session] = await db
    .select({ stateJson: scoringSessionsTable.stateJson })
    .from(scoringSessionsTable)
    .where(eq(scoringSessionsTable.matchId, otherLive.id))
    .limit(1);

  let isLogicallyComplete = false;
  if (session?.stateJson) {
    const otherState = session.stateJson as CricketScoreboardState;
    const terminalCheck = isCricketMatchTerminalState(otherState);
    if (terminalCheck.valid) {
      const derived = deriveCricketMatchResult(otherState);
      // Unambiguous winner: not a tie needing super-over
      if (!derived.isTie) {
        try {
          const matchMeta = buildMatchMetaFromRules({
            matchId: otherLive.id,
            tournamentId: otherLive.tournamentId,
            homeTeamId: otherLive.homeTeamId,
            awayTeamId: otherLive.awayTeamId,
            rules: (otherLive.rulesJson ?? {}) as Record<string, unknown>,
            ruleResolution:
              ((otherLive.runtimePrepMetadataJson as Record<string, unknown> | null)
                ?.ruleResolution as Record<string, unknown> | null) ?? null,
            matchTypeId: otherLive.matchTypeId,
          });

          await appendSingleMatchEvent(
            {
              tournamentId,
              matchId: otherLive.id,
              sportSlug: "cricket",
              eventType: CricketEventType.MATCH_COMPLETED,
              payload: {
                winnerTeamId: derived.winnerTeamId,
                margin: derived.margin,
                resultText: derived.resultText,
                isTie: derived.isTie,
              },
              expectedSequence: otherState.lastSequence,
              actor: { type: "system", id: "auto_completion" },
              matchMeta,
            },
            otherLive,
          );
          // Match 1 was safely completed on behalf of the tournament! Live slot is freed.
          return;
        } catch (autoErr) {
          logger.warn(
            { err: autoErr, otherLiveMatchId: otherLive.id },
            "Auto-completion of logically finished match encountered error, falling back to operator recovery",
          );
          isLogicallyComplete = true;
        }
      } else {
        isLogicallyComplete = true;
      }
    }
  }

  const scope =
    candidateDrawId != null && otherDrawId === candidateDrawId ? "competition" : "tournament";
  throw new ScoringPlatformError(
    `Match #${otherLive.id}${otherLive.matchLabel ? ` (${otherLive.matchLabel})` : ""} is already live in this ${scope}. Please pause or complete it before starting another match.`,
    409,
    "LIVE_MATCH_EXISTS",
    {
      liveMatchId: otherLive.id,
      matchLabel: otherLive.matchLabel,
      roundName: otherLive.roundName,
      homeTeamId: otherLive.homeTeamId,
      awayTeamId: otherLive.awayTeamId,
      isLogicallyComplete,
    },
  );
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

  if (match.fixtureId != null) {
    const fixturePatch: Record<string, unknown> = {};
    if (matchPatch.status) {
      fixturePatch.status = matchPatch.status;
    }
    if (projection.setCompletedAt) {
      fixturePatch.winnerTeamId = projection.winnerTeamId ?? null;
      fixturePatch.resultSummary = projection.resultSummary ?? null;
    }
    if (Object.keys(fixturePatch).length > 0) {
      await tx
        .update(scoringFixturesTable)
        .set(fixturePatch)
        .where(eq(scoringFixturesTable.id, match.fixtureId));
    }
  }

  const [sessionRow] = await tx
    .select({ id: scoringSessionsTable.id })
    .from(scoringSessionsTable)
    .where(eq(scoringSessionsTable.matchId, match.id))
    .limit(1);

  if (sessionRow) {
    await tx
      .update(scoringSessionsTable)
      .set({
        status: projection.sessionStatus ?? "idle",
        stateJson: state as Record<string, unknown>,
        lastEventSeq: projection.lastEventSeq ?? 0,
      })
      .where(eq(scoringSessionsTable.matchId, match.id));
  } else {
    await tx.insert(scoringSessionsTable).values({
      matchId: match.id,
      tournamentId: match.tournamentId,
      status: projection.sessionStatus ?? "idle",
      stateJson: state as Record<string, unknown>,
      lastEventSeq: projection.lastEventSeq ?? 0,
    });
  }

  return updatedMatch;
}

function publishCricketState(
  tournamentId: number,
  match: typeof scoringMatchesTable.$inferSelect,
  state: unknown,
  summary: unknown,
  broadcastEvent?: CricketAuthoritativeBroadcastEvent | null,
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
    broadcastEvent: broadcastEvent ?? null,
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

  if (
    input.eventType === CricketEventType.MATCH_STARTED ||
    input.eventType === CricketEventType.MATCH_RESUMED
  ) {
    await ensureNoOtherLiveCricketMatch(input.tournamentId, input.matchId);
  }

  let eventRow: ScoringEventEnvelope;
  let state: Record<string, unknown>;
  let updatedMatch: typeof scoringMatchesTable.$inferSelect;
  let projection: MatchProjection;
  let broadcastEvent: CricketAuthoritativeBroadcastEvent | null = null;

  try {
    const committed = await db.transaction(async (tx) => {
      // 1. Authoritative lease fencing at the transaction write boundary.
      // Row is locked FOR UPDATE in Postgres to prevent TOCTOU takeover races.
      if (input.lease) {
        await assertAuthoritativeScorerLease(tx, {
          matchId: input.matchId,
          scorerId: input.lease.scorerId,
          sessionId: input.lease.sessionId,
          leaseId: input.lease.leaseId,
          leaseVersion: input.lease.leaseVersion,
        });
      }

      // 2. Idempotent replay of offline-queued events (same correlationId).
      // Checked AFTER verifying lease to prevent stale scorers from replaying or mutating.
      if (input.correlationId) {
        const existing = await findMatchEventByCorrelationId(input.matchId, input.correlationId, tx);
        if (existing) {
          const events = await loadMatchEvents(input.matchId, undefined, tx);
          const replayedState = replayScoringMatchState(input.sportSlug, input.matchMeta, events);
          const lastSeq = events.length > 0 ? events[events.length - 1]!.sequence : 0;
          const replayState = {
            ...(replayedState as Record<string, unknown>),
            lastSequence: lastSeq,
          };
          const [session] = await tx
            .select()
            .from(scoringSessionsTable)
            .where(eq(scoringSessionsTable.matchId, input.matchId))
            .limit(1);
          const [freshMatch] = await tx
            .select()
            .from(scoringMatchesTable)
            .where(eq(scoringMatchesTable.id, input.matchId))
            .limit(1);
          return {
            event: existing,
            state: session?.stateJson ?? replayState,
            match: freshMatch ?? match,
            idempotentReplay: true as const,
          };
        }
      }

      // 3. Serialize concurrent appends for this match.
      await tx.execute(
        sql`SELECT id FROM scoring_sessions WHERE match_id = ${input.matchId} FOR UPDATE`,
      );

      const [session] = await tx
        .select()
        .from(scoringSessionsTable)
        .where(eq(scoringSessionsTable.matchId, input.matchId))
        .limit(1);

      const events = await loadMatchEvents(input.matchId, undefined, tx);
      const currentSeq =
        events.length > 0
          ? events[events.length - 1]!.sequence
          : getCurrentSequence(session?.lastEventSeq);

      try {
        assertExpectedSequence(input.expectedSequence, currentSeq);
      } catch {
        throw new ScoringPlatformError(
          `Sequence conflict: expected ${input.expectedSequence}, current is ${currentSeq}`,
          409,
          "SEQUENCE_CONFLICT",
        );
      }

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

      if (input.eventType === CricketEventType.BALL_UNDONE) {
        const undoneSequences = new Set<number>();
        for (const e of events) {
          if (e.eventType === CricketEventType.BALL_UNDONE) {
            const p = e.payload as { undoesSequence?: number };
            if (typeof p?.undoesSequence === "number") {
              undoneSequences.add(p.undoesSequence);
            }
          }
        }

        const lastActiveBall = [...events]
          .reverse()
          .find(
            (e) =>
              e.eventType === CricketEventType.BALL_RECORDED &&
              !undoneSequences.has(e.sequence),
          );

        if (!lastActiveBall) {
          throw new ScoringPlatformError("No ball to undo", 400, "NOTHING_TO_UNDO");
        }

        const undoPayload = parsed.payload as { undoesSequence: number; undoesEventId?: number };
        if (undoPayload.undoesSequence !== lastActiveBall.sequence) {
          throw new ScoringPlatformError(
            `Target ball sequence ${undoPayload.undoesSequence} does not match last active ball ${lastActiveBall.sequence}`,
            409,
            "UNDO_TARGET_MISMATCH",
          );
        }
      } else {
        try {
          adapter.processEvent(currentState, trialEvent, { enforceLiveRules: true });
        } catch (err) {
          if (err instanceof InvalidEventPayloadError) {
            throw new ScoringPlatformError(err.message, 400, "INVALID_PAYLOAD");
          }
          throw err;
        }
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

      let batterName: string | undefined;
      let bowlerName: string | undefined;
      let battingTeamName: string | undefined;
      let winnerTeamName: string | undefined;
      const eventPayload = parsed.payload as Record<string, unknown>;
      const pIds: number[] = [];
      if (typeof eventPayload.strikerId === "number") pIds.push(eventPayload.strikerId);
      if (typeof eventPayload.bowlerId === "number") pIds.push(eventPayload.bowlerId);
      if (typeof eventPayload.playerId === "number") pIds.push(eventPayload.playerId);
      if (pIds.length > 0) {
        try {
          const pRows = await tx
            .select({ id: playersTable.id, name: playersTable.name })
            .from(playersTable)
            .where(inArray(playersTable.id, pIds));
          for (const pr of pRows) {
            if (pr.id === eventPayload.strikerId || pr.id === eventPayload.playerId) batterName = pr.name;
            if (pr.id === eventPayload.bowlerId) bowlerName = pr.name;
          }
        } catch {
          // ignore lookup failure in test environments
        }
      }

      // Resolve team names for innings complete / match won presentation events
      const tIds: number[] = [];
      const currentInn = (nextState as unknown as CricketScoreboardState)?.innings?.find(
        (i) => i.innings === (nextState as unknown as CricketScoreboardState)?.currentInnings,
      );
      if (currentInn?.battingTeamId) tIds.push(currentInn.battingTeamId);
      if (typeof eventPayload.winnerTeamId === "number") tIds.push(eventPayload.winnerTeamId);
      if (tIds.length > 0) {
        try {
          const tRows = await tx
            .select({ id: teamsTable.id, name: teamsTable.name })
            .from(teamsTable)
            .where(inArray(teamsTable.id, tIds));
          for (const tr of tRows) {
            if (tr.id === currentInn?.battingTeamId) battingTeamName = tr.name;
            if (tr.id === eventPayload.winnerTeamId) winnerTeamName = tr.name;
          }
        } catch {
          // ignore lookup failure in test environments
        }
      }

      const authoritativeBroadcastEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId: input.matchId,
        sequence: newSeq,
        eventType: input.eventType,
        payload: parsed.payload,
        state: nextState as unknown as CricketScoreboardState,
        batterName,
        bowlerName,
        battingTeamName,
        winnerTeamName,
      });

      if (authoritativeBroadcastEvent) {
        console.log(
          `[PRESENTATION_EVENT] matchId=${input.matchId} sequence=${newSeq} eventId=${authoritativeBroadcastEvent.id} type=${authoritativeBroadcastEvent.type} source=authoritative_scoring_event`,
        );
      }

      return {
        eventRow: persisted,
        state: nextState,
        updatedMatch: nextMatch,
        projection: nextProjection,
        broadcastEvent: authoritativeBroadcastEvent,
      };
    });

    if ("idempotentReplay" in committed && committed.idempotentReplay) {
      return committed;
    }

    eventRow = committed.eventRow;
    state = committed.state;
    updatedMatch = committed.updatedMatch;
    projection = committed.projection;
    broadcastEvent = committed.broadcastEvent ?? null;
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

  if (process.env.NODE_ENV !== "production" || process.env.DEBUG_SCORING === "true") {
    if (broadcastEvent) {
      console.log(`[SERVER] broadcastEvent=${broadcastEvent.type} seq=${broadcastEvent.sequence}`);
    }
  }

  publishCricketState(input.tournamentId, updatedMatch, state, summary, broadcastEvent);

  if (input.eventType === CricketEventType.DLS_APPLIED) {
    await persistDlsCalculation(input.matchId, input.tournamentId, parsed.payload);
  }

  try {
    await runPostMatchProjectionPipeline(
      input.sportSlug,
      input.tournamentId,
      input.matchId,
      projection.matchStatus,
    );
  } catch (err) {
    console.error(
      `[SCORING_MUTATION] Post-match projection pipeline failed for match ${input.matchId}:`,
      err,
    );
  }

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
