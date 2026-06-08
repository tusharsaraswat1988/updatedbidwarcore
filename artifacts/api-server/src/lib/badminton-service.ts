/**
 * Badminton Scoring Service
 * Orchestrates event persistence, state replay, and broadcast.
 */

import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scoringMatchesTable,
  scoringEventsTable,
  badmintonMatchDetailsTable,
  badmintonFixturesTable,
  badmintonCourtsTable,
  badmintonCategoriesTable,
  badmintonRegistrationsTable,
  badmintonPlayersTable,
} from "@workspace/db";
import type {
  BadmintonMatchState,
  BadmintonSide,
  BadmintonMatchStartedPayload,
} from "@workspace/badminton-core";
import {
  replayBadmintonEvents,
  cmdAwardPoint,
  cmdUndoLastPoint,
  cmdStartMatch,
  cmdStartInterval,
  cmdEndInterval,
  cmdStartTimeout,
  cmdEndTimeout,
  cmdDeclareRetirement,
  cmdDeclareWalkover,
  cmdDeclareDisqualification,
  STANDARD_FORMAT,
  BEST_OF_5_FORMAT,
} from "@workspace/badminton-core";
import type { BadmintonEventEnvelope } from "@workspace/badminton-core";

export class BadmintonServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BadmintonServiceError";
  }
}

// ── Internal types ───────────────────────────────────────────────────────────

type InternalMatchMeta = {
  matchId: number;
  tournamentId: number;
  matchKind: "singles" | "doubles" | "mixed_doubles";
  format?: typeof STANDARD_FORMAT;
};

// ── Event loading & replay ───────────────────────────────────────────────────

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

export async function getMatchMeta(matchId: number): Promise<InternalMatchMeta | null> {
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
        eq(scoringMatchesTable.sportSlug, "badminton"),
      ),
    )
    .limit(1);

  if (!match) return null;

  const [detail] = await db
    .select({ matchType: badmintonMatchDetailsTable.matchType })
    .from(badmintonMatchDetailsTable)
    .where(eq(badmintonMatchDetailsTable.scoringMatchId, matchId))
    .limit(1);

  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    matchKind: (detail?.matchType ?? "singles") as InternalMatchMeta["matchKind"],
    format: STANDARD_FORMAT,
  };
}

export async function replayMatch(matchId: number): Promise<BadmintonMatchState | null> {
  const meta = await getMatchMeta(matchId);
  if (!meta) return null;

  const events = await loadBadmintonEvents(matchId);
  return replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
}

// ── Event persistence ────────────────────────────────────────────────────────

async function getNextSequence(matchId: number): Promise<number> {
  const [last] = await db
    .select({ sequence: scoringEventsTable.sequence })
    .from(scoringEventsTable)
    .where(eq(scoringEventsTable.matchId, matchId))
    .orderBy(desc(scoringEventsTable.sequence))
    .limit(1);

  return (last?.sequence ?? 0) + 1;
}

async function getLastSequence(matchId: number): Promise<number> {
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
): Promise<void> {
  let seq = await getNextSequence(matchId);

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
}

// ── Snapshot update ──────────────────────────────────────────────────────────

async function updateSnapshot(matchId: number, state: BadmintonMatchState): Promise<void> {
  await db
    .update(badmintonMatchDetailsTable)
    .set({
      stateSnapshotJson: state as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(badmintonMatchDetailsTable.scoringMatchId, matchId));

  if (state.matchStatus === "completed" || state.matchStatus === "walkover" || state.matchStatus === "retired") {
    await db
      .update(scoringMatchesTable)
      .set({
        status: "completed",
        winnerTeamId: null,
        resultSummary: state.resultReason ?? "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scoringMatchesTable.id, matchId));
  } else if (state.matchStatus === "live") {
    await db
      .update(scoringMatchesTable)
      .set({ status: "live", startedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.status, "scheduled"),
        ),
      );
  }
}

// ── Command handlers ─────────────────────────────────────────────────────────

type Actor = { type: string; id?: string | null };

export async function startBadmintonMatch(
  matchId: number,
  input: BadmintonMatchStartedPayload,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdStartMatch(state, input);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId, fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId));

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId: match.tournamentId,
      fixtureId: match.fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, newState);
  return newState;
}

export async function awardPoint(
  matchId: number,
  winningSide: BadmintonSide,
  actor: Actor,
  opts?: { rallyLength?: number },
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdAwardPoint(state, winningSide, opts);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId, fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId));

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId: match.tournamentId,
      fixtureId: match.fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, newState);
  return newState;
}

export async function undoLastPoint(
  matchId: number,
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);

  const lastPointSeq = await getLastSequence(matchId);
  if (lastPointSeq === 0) {
    throw new BadmintonServiceError("NO_POINTS", "No points to undo");
  }

  const result = cmdUndoLastPoint(state, lastPointSeq);
  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId, fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId));

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId: match.tournamentId,
      fixtureId: match.fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, newState);
  return newState;
}

export async function handleTimeout(
  matchId: number,
  action: "start" | "end",
  side: BadmintonSide | null,
  kind: "regular" | "medical",
  actor: Actor,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);

  const result =
    action === "start" && side
      ? cmdStartTimeout(state, side, kind)
      : cmdEndTimeout(state);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId, fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId));

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId: match.tournamentId,
      fixtureId: match.fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, newState);
  return newState;
}

export async function handleRetirement(
  matchId: number,
  retiringSide: BadmintonSide,
  actor: Actor,
  reason?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdDeclareRetirement(state, retiringSide, reason);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId, fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId));

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId: match.tournamentId,
      fixtureId: match.fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, newState);
  return newState;
}

export async function handleWalkover(
  matchId: number,
  winningSide: BadmintonSide,
  actor: Actor,
  reason?: string,
): Promise<BadmintonMatchState> {
  const meta = await getMatchMeta(matchId);
  if (!meta) throw new BadmintonServiceError("MATCH_NOT_FOUND", "Match not found");

  const events = await loadBadmintonEvents(matchId);
  const state = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], events);
  const result = cmdDeclareWalkover(state, winningSide, reason);

  if (!result.ok) throw new BadmintonServiceError("COMMAND_FAILED", result.error);

  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId, fixtureId: scoringMatchesTable.fixtureId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId));

  await appendEvents(
    matchId,
    result.events.map((e) => ({
      tournamentId: match.tournamentId,
      fixtureId: match.fixtureId,
      eventType: e.eventType,
      payload: e.payload,
      actorType: actor.type,
      actorId: actor.id,
    })),
  );

  const newEvents = await loadBadmintonEvents(matchId);
  const newState = replayBadmintonEvents(meta as Parameters<typeof replayBadmintonEvents>[0], newEvents);
  await updateSnapshot(matchId, newState);
  return newState;
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
      eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(asc(scoringMatchesTable.id));

  type MatchRow = { match: typeof scoringMatchesTable.$inferSelect; detail: typeof badmintonMatchDetailsTable.$inferSelect | null };
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

  if (input.fixtureId) {
    await db
      .update(badmintonFixturesTable)
      .set({ scoringMatchId: match.id, updatedAt: new Date() })
      .where(eq(badmintonFixturesTable.id, input.fixtureId));
  }

  return match;
}
