import { db } from "@workspace/db";
import {
  scoringEventsTable,
  scoringMatchesTable,
  scoringSessionsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  CricketEventType,
  createInitialCricketState,
  parseCricketEventPayload,
  replayCricketEvents,
  assertExpectedSequence,
  nextSequence,
  getCurrentSequence,
  type ScoringEventEnvelope,
  type MatchMeta,
  type CricketScoreboardState,
} from "@workspace/scoring-core";
import { and, desc, eq, ne } from "drizzle-orm";

export type ScoringActor = {
  type: "organizer" | "admin" | "scorer_pin" | "system";
  id?: string | null;
};

export class ScoringServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ScoringServiceError";
  }
}

function rowToEnvelope(row: typeof scoringEventsTable.$inferSelect): ScoringEventEnvelope {
  return {
    id: row.id,
    matchId: row.matchId,
    tournamentId: row.tournamentId,
    fixtureId: row.fixtureId,
    sportSlug: row.sportSlug as "cricket",
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    sequence: row.sequence,
    occurredAt: row.occurredAt,
    actorType: row.actorType as ScoringEventEnvelope["actorType"],
    actorId: row.actorId,
    correlationId: row.correlationId,
    causationId: row.causationId,
    payload: row.payloadJson ?? {},
  };
}

function matchMetaFromRow(match: typeof scoringMatchesTable.$inferSelect): MatchMeta {
  const rules = match.rulesJson ?? {};
  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    oversLimit: rules.overs ?? 20,
    maxWickets: rules.maxWickets ?? 10,
  };
}

async function loadMatchEvents(matchId: number): Promise<ScoringEventEnvelope[]> {
  const rows = await db
    .select()
    .from(scoringEventsTable)
    .where(eq(scoringEventsTable.matchId, matchId))
    .orderBy(scoringEventsTable.sequence);
  return rows.map(rowToEnvelope);
}

async function projectMatchState(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<CricketScoreboardState> {
  const events = await loadMatchEvents(match.id);
  const state = replayCricketEvents(matchMetaFromRow(match), events);
  const lastSeq = events.length > 0 ? events[events.length - 1]!.sequence : 0;
  return { ...state, lastSequence: lastSeq };
}

async function ensureTournamentScoring(tournamentId: number) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    throw new ScoringServiceError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }
  return tournament;
}

async function ensureTeamInTournament(tournamentId: number, teamId: number) {
  const [team] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)))
    .limit(1);
  if (!team) {
    throw new ScoringServiceError(`Team ${teamId} not found in tournament`, 400, "INVALID_TEAM");
  }
}

export async function createScoringMatch(
  tournamentId: number,
  input: {
    homeTeamId: number;
    awayTeamId: number;
    fixtureId?: number | null;
    oversLimit?: number;
    roundName?: string | null;
    scheduledAt?: string | null;
    venue?: string | null;
  },
) {
  const tournament = await ensureTournamentScoring(tournamentId);
  if (tournament.sport !== "cricket") {
    throw new ScoringServiceError("Only cricket scoring is supported in V1", 400, "UNSUPPORTED_SPORT");
  }
  if (input.homeTeamId === input.awayTeamId) {
    throw new ScoringServiceError("Home and away teams must differ", 400, "INVALID_TEAMS");
  }
  await ensureTeamInTournament(tournamentId, input.homeTeamId);
  await ensureTeamInTournament(tournamentId, input.awayTeamId);

  const oversLimit = input.oversLimit ?? 20;

  const [match] = await db
    .insert(scoringMatchesTable)
    .values({
      tournamentId,
      fixtureId: input.fixtureId ?? null,
      sportSlug: "cricket",
      matchKind: "team_match",
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeSideJson: { teamId: input.homeTeamId },
      awaySideJson: { teamId: input.awayTeamId },
      rulesJson: { overs: oversLimit, maxWickets: 10 },
      roundName: input.roundName ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      venue: input.venue ?? null,
      status: "scheduled",
    })
    .returning();

  const initialState = createInitialCricketState(matchMetaFromRow(match));

  await db.insert(scoringSessionsTable).values({
    matchId: match.id,
    tournamentId,
    status: "idle",
    stateJson: initialState,
    lastEventSeq: 0,
  });

  return { match, state: initialState };
}

export async function getScoringMatch(tournamentId: number, matchId: number) {
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(eq(scoringMatchesTable.id, matchId), eq(scoringMatchesTable.tournamentId, tournamentId)),
    )
    .limit(1);

  if (!match) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  const state = await projectMatchState(match);
  const events = await loadMatchEvents(matchId);

  return { match, state, events };
}

export async function appendScoringEvent(
  tournamentId: number,
  matchId: number,
  input: {
    eventType: string;
    payload: Record<string, unknown>;
    expectedSequence: number;
    actor: ScoringActor;
    correlationId?: string | null;
  },
) {
  const parsed = parseCricketEventPayload(input.eventType, input.payload);
  if (!parsed.ok) {
    throw new ScoringServiceError(parsed.error, 400, "INVALID_PAYLOAD");
  }

  const { match } = await getScoringMatch(tournamentId, matchId);

  if (match.status === "completed" || match.status === "abandoned") {
    throw new ScoringServiceError("Match is no longer live", 409, "MATCH_CLOSED");
  }

  const [session] = await db
    .select()
    .from(scoringSessionsTable)
    .where(eq(scoringSessionsTable.matchId, matchId))
    .limit(1);

  const currentSeq = getCurrentSequence(session?.lastEventSeq);
  try {
    assertExpectedSequence(input.expectedSequence, currentSeq);
  } catch {
    throw new ScoringServiceError(
      `Sequence conflict: expected ${input.expectedSequence}, current is ${currentSeq}`,
      409,
      "SEQUENCE_CONFLICT",
    );
  }

  if (input.eventType === CricketEventType.MATCH_STARTED) {
    const [otherLive] = await db
      .select({ id: scoringMatchesTable.id })
      .from(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(scoringMatchesTable.status, "live"),
          ne(scoringMatchesTable.id, matchId),
        ),
      )
      .limit(1);
    if (otherLive) {
      throw new ScoringServiceError(
        "Another match is already live in this tournament",
        409,
        "LIVE_MATCH_EXISTS",
      );
    }
  }

  const newSeq = nextSequence(currentSeq);

  const [eventRow] = await db
    .insert(scoringEventsTable)
    .values({
      matchId,
      tournamentId,
      fixtureId: match.fixtureId,
      sportSlug: "cricket",
      eventType: input.eventType,
      eventVersion: 1,
      sequence: newSeq,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      correlationId: input.correlationId ?? null,
      payloadJson: parsed.payload,
    })
    .returning();

  const state = await projectMatchState(match);
  const matchStatus = state.matchStatus;
  const matchPatch: Partial<typeof scoringMatchesTable.$inferInsert> = {
    status: matchStatus,
    currentProjectionVersion: newSeq,
  };

  if (matchStatus === "live" && !match.startedAt) {
    matchPatch.startedAt = new Date();
  }
  if (matchStatus === "completed" || matchStatus === "abandoned") {
    matchPatch.completedAt = new Date();
    matchPatch.winnerTeamId = state.winnerTeamId;
    matchPatch.resultSummary = state.resultText;
  }

  const [updatedMatch] = await db
    .update(scoringMatchesTable)
    .set(matchPatch)
    .where(eq(scoringMatchesTable.id, matchId))
    .returning();

  await db
    .update(scoringSessionsTable)
    .set({
      status: state.sessionStatus,
      stateJson: state,
      lastEventSeq: newSeq,
    })
    .where(eq(scoringSessionsTable.matchId, matchId));

  return {
    event: rowToEnvelope(eventRow),
    state,
    match: updatedMatch,
  };
}

export async function undoLastScoringEvent(
  tournamentId: number,
  matchId: number,
  input: { expectedSequence: number; actor: ScoringActor },
) {
  const { match } = await getScoringMatch(tournamentId, matchId);

  const events = await loadMatchEvents(matchId);
  const undoneSequences = new Set(
    events
      .filter((e) => e.eventType === CricketEventType.BALL_UNDONE)
      .map((e) => (e.payload as { undoesSequence: number }).undoesSequence),
  );

  const lastBall = [...events]
    .reverse()
    .find(
      (e) =>
        e.eventType === CricketEventType.BALL_RECORDED && !undoneSequences.has(e.sequence),
    );

  if (!lastBall) {
    throw new ScoringServiceError("No ball to undo", 400, "NOTHING_TO_UNDO");
  }

  return appendScoringEvent(tournamentId, matchId, {
    eventType: CricketEventType.BALL_UNDONE,
    payload: {
      undoesEventId: lastBall.id ?? 0,
      undoesSequence: lastBall.sequence,
    },
    expectedSequence: input.expectedSequence,
    actor: input.actor,
  });
}
