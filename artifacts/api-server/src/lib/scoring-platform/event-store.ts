import { db } from "@workspace/db";
import { scoringEventsTable } from "@workspace/db";
import type { ScoringEventEnvelope, ScoringSportSlug } from "@workspace/scoring-core";
import { and, asc, desc, eq, sql } from "drizzle-orm";

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

type EventStoreTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function persistScoringEvent(
  input: PersistEventInput,
  tx: EventStoreTx | typeof db = db,
) {
  const [row] = await tx
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

/**
 * Persist a batch of events atomically (Sprint 1 / C6).
 * Sequence allocation + inserts happen inside one transaction so a
 * multi-event game/match end cannot tear mid-batch.
 */
export async function persistScoringEventBatch(
  matchId: number,
  inputs: PersistEventInput[],
): Promise<{ startSequence: number; envelopes: ScoringEventEnvelope[] }> {
  if (inputs.length === 0) {
    const next = await getNextEventSequence(matchId);
    return { startSequence: next, envelopes: [] };
  }

  const result = await db.transaction(async (tx) => {
    const [last] = await tx
      .select({ sequence: scoringEventsTable.sequence })
      .from(scoringEventsTable)
      .where(eq(scoringEventsTable.matchId, matchId))
      .orderBy(desc(scoringEventsTable.sequence))
      .limit(1);

    let seq = (last?.sequence ?? 0) + 1;
    const startSequence = seq;
    const envelopes: ScoringEventEnvelope[] = [];

    for (const input of inputs) {
      const envelope = await persistScoringEvent(
        { ...input, matchId, sequence: seq },
        tx,
      );
      envelopes.push(envelope);
      seq += 1;
    }

    return { startSequence, envelopes };
  });

  try {
    const { markLatency } = await import("../badminton-latency-trace");
    markLatency("t3_event_written");
  } catch {
    // measurement module optional
  }

  return result;
}

/**
 * Return true when a POINT_WON (or any) event for this match already carries
 * the given client idempotency key (Sprint 1 / C6).
 */
export async function findMatchEventByIdempotencyKey(
  matchId: number,
  idempotencyKey: string,
): Promise<ScoringEventEnvelope | null> {
  const key = idempotencyKey.trim();
  if (!key) return null;

  const [row] = await db
    .select()
    .from(scoringEventsTable)
    .where(
      and(
        eq(scoringEventsTable.matchId, matchId),
        sql`${scoringEventsTable.payloadJson}->>'idempotencyKey' = ${key}`,
      ),
    )
    .orderBy(asc(scoringEventsTable.sequence))
    .limit(1);

  return row ? rowToEnvelope(row) : null;
}
