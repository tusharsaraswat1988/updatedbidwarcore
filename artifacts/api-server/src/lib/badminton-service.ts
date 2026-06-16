/**
 * Badminton Scoring Service
 *
 * Tenant-isolation contract:
 * - Every public function that operates on a match MUST receive tournamentId
 *   and verify match.tournamentId === tournamentId before mutating state.
 * - No function may be called with only a matchId; callers must prove
 *   they know which tournament the match belongs to.
 */

import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scoringMatchesTable,
  scoringEventsTable,
  badmintonMatchDetailsTable,
  badmintonFixturesTable,
  badmintonAnalyticsTable,
  tournamentsTable,
  type ScoringSideJson,
} from "@workspace/db";
import type {
  BadmintonMatchState,
  BadmintonSide,
  BadmintonMatchStartedPayload,
} from "@workspace/badminton-core";
import {
  replayBadmintonEvents,
  reduceBadminton,
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
  type MatchPauseReason,
} from "@workspace/badminton-core";
import type { BadmintonEventEnvelope } from "@workspace/badminton-core";
import { updateBadmintonStatisticsFromMatch } from "./master-sports/badminton";

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
  format?: typeof STANDARD_FORMAT;
};

type Actor = { type: string; id?: string | null };

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
    .select({ matchType: badmintonMatchDetailsTable.matchType })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, expectedTournamentId), // <-- isolation guard
      ),
    )
    .limit(1);

  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    matchKind: (detail?.matchType ?? "singles") as InternalMatchMeta["matchKind"],
    format: STANDARD_FORMAT,
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
  return replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
}

// ── Internal: sequence helpers ────────────────────────────────────────────────

async function getNextSequence(matchId: number): Promise<number> {
  const [last] = await db
    .select({ sequence: scoringEventsTable.sequence })
    .from(scoringEventsTable)
    .where(eq(scoringEventsTable.matchId, matchId))
    .orderBy(desc(scoringEventsTable.sequence))
    .limit(1);

  return (last?.sequence ?? 0) + 1;
}

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
  return replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
}

// ── Internal: event persistence ───────────────────────────────────────────────

type AppendEventInput = {
  tournamentId: number;
  fixtureId?: number | null;
  eventType: string;
  payload: Record<string, unknown>;
  actorType: string;
  actorId?: string | null;
};

async function appendEvents(
  matchId: number,
  inputs: AppendEventInput[],
): Promise<number> {
  let seq = await getNextSequence(matchId);
  const startSeq = seq;

  for (const input of inputs) {
    await db.insert(scoringEventsTable).values({
      matchId,
      tournamentId: input.tournamentId,
      fixtureId: input.fixtureId ?? null,
      sportSlug: "badminton",
      eventType: input.eventType,
      eventVersion: 1,
      sequence: seq++,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      payloadJson: input.payload,
    });
  }

  return startSeq;
}

function applyPersistedCommandEvents(
  state: BadmintonMatchState,
  commandEvents: Array<{ eventType: string; payload: Record<string, unknown> }>,
  startSequence: number,
  matchId: number,
  tournamentId: number,
): BadmintonMatchState {
  let next = state;
  let seq = startSequence;

  for (const event of commandEvents) {
    next = reduceBadminton(next, {
      matchId,
      tournamentId,
      sportSlug: "badminton",
      eventType: event.eventType,
      eventVersion: 1,
      sequence: seq,
      actorType: "system",
      payload: event.payload,
    });
    seq += 1;
  }

  return next;
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
      void updateBadmintonStatisticsFromMatch(
        state,
        tournamentId,
        detail.leftSideJson as Record<string, unknown>,
        detail.rightSideJson as Record<string, unknown>,
      ).catch((err) => {
        console.error("[master-sports] updateBadmintonStatisticsFromMatch failed:", err);
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdStartMatch(state, input);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  const startSeq = await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newState = applyPersistedCommandEvents(
    state,
    result.events,
    startSeq,
    matchId,
    tournamentId,
  );
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  const startSeq = await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newState = applyPersistedCommandEvents(
    state,
    result.events,
    startSeq,
    matchId,
    tournamentId,
  );
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
}

export async function undoLastPoint(
  matchId: number,
  tournamentId: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);

  const undoTargets = getUndoTargetSequences(events);
  if (undoTargets.length === 0) {
    throw new BadmintonServiceError("NO_POINTS", "No points to undo");
  }

  const result = cmdUndoLastPoint(state, undoTargets);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);

  const result =
    action === "start" && side
      ? cmdStartTimeout(state, side, kind)
      : cmdEndTimeout(state);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);

  const result = action === "start" ? cmdStartInterval(state) : cmdEndInterval(state);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
}

export async function handleCourtChangeAck(
  matchId: number,
  tournamentId: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId, tournamentId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found in this tournament");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdAcknowledgeCourtChange(state);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdDeclareRetirement(state, retiringSide, reason);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdDeclareWalkover(state, winningSide, reason);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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

  const fixtureId = await getMatchFixtureId(matchId, tournamentId);

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId,
      fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, tournamentId, newState);
  return newState;
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
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
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  return buildMatchReport(state, events);
}

// ── Query helpers ─────────────────────────────────────────────────────────────

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
  refereeName?: string;
  umpireName?: string;
  scheduledAt?: Date;
}) {
  await ensureBadmintonTournament(input.tournamentId);

  const homeSideJson = buildScoringSideFromBadmintonSide(input.leftSideJson);
  const awaySideJson = buildScoringSideFromBadmintonSide(input.rightSideJson);

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

  await db.insert(badmintonMatchDetailsTable).values({
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
    matchFormatJson: input.matchFormatJson ?? null,
    leftSideJson: input.leftSideJson,
    rightSideJson: input.rightSideJson,
    scorerPin: input.scorerPin ?? null,
    scorerName: input.scorerName ?? null,
    refereeName: input.refereeName ?? null,
    umpireName: input.umpireName ?? null,
  });

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

  return match;
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
