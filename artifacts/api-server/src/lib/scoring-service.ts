import { db } from "@workspace/db";
import {
  scoringMatchesTable,
  scoringSessionsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildCricketMatchSummary,
  createInitialCricketState,
  type MatchMeta,
  type CricketScoreboardState,
  type CricketMatchSummary,
} from "@workspace/scoring-core";
import { and, desc, eq, inArray } from "drizzle-orm";
import { replayScoringMatchState } from "./scoring-platform";
import { ScoringPlatformError } from "./scoring-platform/errors";
import { appendSingleMatchEvent, type ScoringActor } from "./scoring-platform/orchestrator";
import { loadMatchEvents } from "./scoring-platform/event-store";
import { cricketFranchiseTeamExists } from "./master-sports/cricket-franchise-registry";

export type { ScoringActor };

export class ScoringServiceError extends ScoringPlatformError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "ScoringServiceError";
  }
}

function mapPlatformError<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof ScoringPlatformError) {
      throw new ScoringServiceError(err.message, err.status, err.code);
    }
    throw err;
  });
}

const CRICKET_SPORT_SLUG = "cricket" as const;

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

async function projectMatchState(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<CricketScoreboardState> {
  const events = await loadMatchEvents(match.id);
  const state = replayScoringMatchState<CricketScoreboardState>(
    CRICKET_SPORT_SLUG,
    matchMetaFromRow(match),
    events,
  );
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
  if (!tournament.scoringEnabled) {
    throw new ScoringServiceError("Scoring is not enabled for this tournament", 403, "SCORING_DISABLED");
  }
  if (tournament.sport !== CRICKET_SPORT_SLUG) {
    throw new ScoringServiceError("Only cricket scoring is supported in V1", 400, "UNSUPPORTED_SPORT");
  }
  return tournament;
}

async function ensureTeamInTournament(tournamentId: number, teamId: number) {
  const ok = await cricketFranchiseTeamExists(tournamentId, teamId);
  if (!ok) {
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

function summaryFromMatch(
  match: typeof scoringMatchesTable.$inferSelect,
  state: CricketScoreboardState,
): CricketMatchSummary {
  if (match.summaryJson && typeof match.summaryJson === "object") {
    return match.summaryJson as CricketMatchSummary;
  }
  return buildCricketMatchSummary(state);
}

/** Live or most recently finished match for LED / public display. */
export async function getLiveScoringDisplay(tournamentId: number) {
  await ensureTournamentScoring(tournamentId);

  const [live] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
        eq(scoringMatchesTable.status, "live"),
      ),
    )
    .orderBy(desc(scoringMatchesTable.startedAt))
    .limit(1);

  let match = live;
  if (!match) {
    const [recent] = await db
      .select()
      .from(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
          inArray(scoringMatchesTable.status, ["completed", "abandoned"]),
        ),
      )
      .orderBy(desc(scoringMatchesTable.completedAt))
      .limit(1);
    match = recent;
  }

  if (!match) {
    return { match: null, state: null, summary: null };
  }

  const state = await projectMatchState(match);
  const summary = summaryFromMatch(match, state);
  return { match, state, summary };
}

export async function listScoringMatches(tournamentId: number) {
  await ensureTournamentScoring(tournamentId);
  return db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    )
    .orderBy(desc(scoringMatchesTable.createdAt));
}

export async function getScoringMatch(tournamentId: number, matchId: number) {
  await ensureTournamentScoring(tournamentId);

  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
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
  await ensureTournamentScoring(tournamentId);

  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    )
    .limit(1);

  if (!match) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  return mapPlatformError(() =>
    appendSingleMatchEvent(
      {
        tournamentId,
        matchId,
        sportSlug: CRICKET_SPORT_SLUG,
        eventType: input.eventType,
        payload: input.payload,
        expectedSequence: input.expectedSequence,
        actor: input.actor,
        correlationId: input.correlationId,
        matchMeta: matchMetaFromRow(match),
      },
      match,
    ),
  );
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
