/** Supported sport slugs for scoring (V1 implements cricket reducer only). */
export type ScoringSportSlug = "cricket" | "badminton";

export type ScoringMatchStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "abandoned"
  | "cancelled";

export type ScoringSessionStatus = "idle" | "live" | "paused" | "break";

export type ScoringPhase = "disabled" | "setup" | "live" | "completed";

export type ScoringActorType = "organizer" | "admin" | "scorer_pin" | "system";

/** Generic event envelope — mirrors scoring_events row shape for reducer input. */
export type ScoringEventEnvelope<TPayload = Record<string, unknown>> = {
  id?: number;
  matchId: number;
  tournamentId: number;
  fixtureId?: number | null;
  sportSlug: ScoringSportSlug;
  eventType: string;
  eventVersion: number;
  sequence: number;
  occurredAt?: Date | string;
  actorType: ScoringActorType;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: number | null;
  payload: TPayload;
};

export type MatchMeta = {
  matchId: number;
  tournamentId: number;
  homeTeamId: number;
  awayTeamId: number;
  oversLimit: number;
};
