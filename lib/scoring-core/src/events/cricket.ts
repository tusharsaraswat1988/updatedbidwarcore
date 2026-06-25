import { z } from "zod";
import { DISMISSAL_TYPES, EXTRA_TYPES } from "../cricket/types";

/** Cricket event type constants. */
export const CricketEventType = {
  MATCH_STARTED: "cricket.match.started",
  LINEUP_SET: "cricket.lineup.set",
  BALL_RECORDED: "cricket.ball.recorded",
  INNINGS_ENDED: "cricket.innings.ended",
  MATCH_COMPLETED: "cricket.match.completed",
  BALL_UNDONE: "cricket.ball.undone",
  MATCH_ABANDONED: "cricket.match.abandoned",
  PENALTY_AWARDED: "cricket.penalty.awarded",
  PLAYER_RETIRED: "cricket.player.retired",
  SUPER_OVER_STARTED: "cricket.super_over.started",
} as const;

export type CricketEventTypeName = (typeof CricketEventType)[keyof typeof CricketEventType];

export const CRICKET_EVENT_TYPES = Object.values(CricketEventType);

const tossChoiceSchema = z.enum(["bat", "bowl"]);

export const cricketMatchStartedPayloadSchema = z.object({
  tossWinnerTeamId: z.number().int().positive(),
  electedTo: tossChoiceSchema,
  oversLimit: z.number().int().positive(),
  powerplayOvers: z.array(z.number().int().positive()).optional(),
});

export const cricketLineupSetPayloadSchema = z.object({
  teamId: z.number().int().positive(),
  playerIds: z.array(z.number().int().positive()).min(1).max(11),
  battingOrder: z.array(z.number().int().positive()).optional(),
});

const extrasSchema = z.object({
  type: z.enum(EXTRA_TYPES).nullable(),
  runs: z.number().int().min(0).default(0),
});

const wicketSchema = z
  .object({
    type: z.enum(DISMISSAL_TYPES),
    dismissedPlayerId: z.number().int().positive(),
    fielderId: z.number().int().positive().optional(),
  })
  .nullable();

export const cricketBallRecordedPayloadSchema = z.object({
  innings: z.number().int().min(1).max(4),
  over: z.number().int().min(0),
  ball: z.number().int().min(1).max(6),
  strikerId: z.number().int().positive(),
  nonStrikerId: z.number().int().positive(),
  bowlerId: z.number().int().positive(),
  runsOffBat: z.number().int().min(0).max(6),
  extras: extrasSchema,
  wicket: wicketSchema,
  isLegalDelivery: z.boolean(),
});

export const cricketInningsEndedPayloadSchema = z.object({
  innings: z.number().int().min(1).max(4),
  reason: z.enum(["all_out", "overs_complete", "declared", "target_reached", "super_over_required"]),
  runs: z.number().int().min(0),
  wickets: z.number().int().min(0),
  overs: z.string(),
});

export const cricketMatchCompletedPayloadSchema = z.object({
  winnerTeamId: z.number().int().positive().nullable(),
  margin: z.string(),
  resultText: z.string(),
  isTie: z.boolean().optional(),
});

export const cricketBallUndonePayloadSchema = z.object({
  undoesEventId: z.number().int().positive(),
  undoesSequence: z.number().int().positive(),
});

export const cricketMatchAbandonedPayloadSchema = z.object({
  reason: z.string().min(1),
});

export const cricketPenaltyAwardedPayloadSchema = z.object({
  innings: z.number().int().min(1).max(4),
  battingTeamId: z.number().int().positive(),
  runs: z.number().int().positive(),
  reason: z.string().optional(),
});

export const cricketPlayerRetiredPayloadSchema = z.object({
  innings: z.number().int().min(1).max(4),
  teamId: z.number().int().positive(),
  playerId: z.number().int().positive(),
  type: z.enum(["hurt", "out"]),
});

export const cricketSuperOverStartedPayloadSchema = z.object({
  innings: z.number().int().min(3).max(4),
  battingTeamId: z.number().int().positive(),
  bowlingTeamId: z.number().int().positive(),
  oversLimit: z.number().int().positive().default(1),
});

export type CricketMatchStartedPayload = z.infer<typeof cricketMatchStartedPayloadSchema>;
export type CricketLineupSetPayload = z.infer<typeof cricketLineupSetPayloadSchema>;
export type CricketBallRecordedPayload = z.infer<typeof cricketBallRecordedPayloadSchema>;
export type CricketInningsEndedPayload = z.infer<typeof cricketInningsEndedPayloadSchema>;
export type CricketMatchCompletedPayload = z.infer<typeof cricketMatchCompletedPayloadSchema>;
export type CricketBallUndonePayload = z.infer<typeof cricketBallUndonePayloadSchema>;
export type CricketMatchAbandonedPayload = z.infer<typeof cricketMatchAbandonedPayloadSchema>;
export type CricketPenaltyAwardedPayload = z.infer<typeof cricketPenaltyAwardedPayloadSchema>;
export type CricketPlayerRetiredPayload = z.infer<typeof cricketPlayerRetiredPayloadSchema>;
export type CricketSuperOverStartedPayload = z.infer<typeof cricketSuperOverStartedPayloadSchema>;

const cricketPayloadSchemas: Record<CricketEventTypeName, z.ZodType<Record<string, unknown>>> = {
  [CricketEventType.MATCH_STARTED]: cricketMatchStartedPayloadSchema,
  [CricketEventType.LINEUP_SET]: cricketLineupSetPayloadSchema,
  [CricketEventType.BALL_RECORDED]: cricketBallRecordedPayloadSchema,
  [CricketEventType.INNINGS_ENDED]: cricketInningsEndedPayloadSchema,
  [CricketEventType.MATCH_COMPLETED]: cricketMatchCompletedPayloadSchema,
  [CricketEventType.BALL_UNDONE]: cricketBallUndonePayloadSchema,
  [CricketEventType.MATCH_ABANDONED]: cricketMatchAbandonedPayloadSchema,
  [CricketEventType.PENALTY_AWARDED]: cricketPenaltyAwardedPayloadSchema,
  [CricketEventType.PLAYER_RETIRED]: cricketPlayerRetiredPayloadSchema,
  [CricketEventType.SUPER_OVER_STARTED]: cricketSuperOverStartedPayloadSchema,
};

export function isCricketEventType(type: string): type is CricketEventTypeName {
  return (CRICKET_EVENT_TYPES as string[]).includes(type);
}

export function parseCricketEventPayload(
  eventType: string,
  payload: unknown,
):
  | { ok: true; eventType: CricketEventTypeName; payload: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!isCricketEventType(eventType)) {
    return { ok: false, error: `Unknown cricket event type: ${eventType}` };
  }
  const result = cricketPayloadSchemas[eventType].safeParse(payload);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, eventType, payload: result.data };
}
