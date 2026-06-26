import { db } from "@workspace/db";
import { scoringEventsTable } from "@workspace/db";
import type { ScoringEventEnvelope, ScoringSportSlug } from "@workspace/scoring-core";
import { and, asc, desc, eq } from "drizzle-orm";

export function rowToEnvelope(
  row: typeof scoringEventsTable.$inferSelect,
): ScoringEventEnvelope {
  return {
    id: row.id,
    matchId: row.matchId,
    tournamentId: row.tournamentId,
    fixtureId: row.fixtureId,
    sportSlug: row.sportSlug as ScoringSportSlug,
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

export async function loadMatchEvents(
  matchId: number,
  sportSlug?: ScoringSportSlug,
): Promise<ScoringEventEnvelope[]> {
  const conditions = [eq(scoringEventsTable.matchId, matchId)];
  if (sportSlug) {
    conditions.push(eq(scoringEventsTable.sportSlug, sportSlug));
  }

  const rows = await db
    .select()
    .from(scoringEventsTable)
    .where(and(...conditions))
    .orderBy(asc(scoringEventsTable.sequence));

  return rows.map(rowToEnvelope);
}

export async function getNextEventSequence(matchId: number): Promise<number> {
  const [last] = await db
    .select({ sequence: scoringEventsTable.sequence })
    .from(scoringEventsTable)
    .where(eq(scoringEventsTable.matchId, matchId))
    .orderBy(desc(scoringEventsTable.sequence))
    .limit(1);

  return (last?.sequence ?? 0) + 1;
}

export type PersistEventInput = {
  matchId: number;
  tournamentId: number;
  fixtureId?: number | null;
  sportSlug: ScoringSportSlug;
  eventType: string;
  sequence: number;
  actorType: string;
  actorId?: string | null;
  correlationId?: string | null;
  payload: Record<string, unknown>;
};

export async function persistScoringEvent(input: PersistEventInput) {
  const [row] = await db
    .insert(scoringEventsTable)
    .values({
      matchId: input.matchId,
      tournamentId: input.tournamentId,
      fixtureId: input.fixtureId ?? null,
      sportSlug: input.sportSlug,
      eventType: input.eventType,
      eventVersion: 1,
      sequence: input.sequence,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      correlationId: input.correlationId ?? null,
      payloadJson: input.payload,
    })
    .returning();

  return rowToEnvelope(row);
}

export async function persistScoringEventBatch(
  matchId: number,
  inputs: PersistEventInput[],
): Promise<{ startSequence: number; envelopes: ScoringEventEnvelope[] }> {
  let seq = await getNextEventSequence(matchId);
  const startSequence = seq;
  const envelopes: ScoringEventEnvelope[] = [];

  for (const input of inputs) {
    const envelope = await persistScoringEvent({ ...input, matchId, sequence: seq });
    envelopes.push(envelope);
    seq += 1;
  }

  return { startSequence, envelopes };
}
