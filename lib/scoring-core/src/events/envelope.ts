import type { ScoringActorType, ScoringEventEnvelope, ScoringSportSlug } from "../types";

export type CreateEventInput<TPayload extends Record<string, unknown>> = {
  matchId: number;
  tournamentId: number;
  fixtureId?: number | null;
  sportSlug: ScoringSportSlug;
  eventType: string;
  sequence: number;
  payload: TPayload;
  actorType: ScoringActorType;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: number | null;
  eventVersion?: number;
  occurredAt?: Date;
};

/** Build an in-memory event envelope (before persistence). */
export function createEventEnvelope<TPayload extends Record<string, unknown>>(
  input: CreateEventInput<TPayload>,
): ScoringEventEnvelope<TPayload> {
  return {
    matchId: input.matchId,
    tournamentId: input.tournamentId,
    fixtureId: input.fixtureId ?? null,
    sportSlug: input.sportSlug,
    eventType: input.eventType,
    eventVersion: input.eventVersion ?? 1,
    sequence: input.sequence,
    occurredAt: input.occurredAt ?? new Date(),
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    payload: input.payload,
  };
}
