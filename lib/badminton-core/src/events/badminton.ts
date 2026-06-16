import { z } from "zod";
import type { BadmintonMatchFormat, BadmintonMatchKind, BadmintonSide, BadmintonSideInfo } from "../types";

export const BadmintonEventType = {
  MATCH_STARTED: "badminton.match.started",
  POINT_WON: "badminton.point.won",
  POINT_UNDONE: "badminton.point.undone",
  GAME_ENDED: "badminton.game.ended",
  MATCH_ENDED: "badminton.match.ended",
  INTERVAL_STARTED: "badminton.interval.started",
  INTERVAL_ENDED: "badminton.interval.ended",
  TIMEOUT_STARTED: "badminton.timeout.started",
  TIMEOUT_ENDED: "badminton.timeout.ended",
  SIDE_CHANGED: "badminton.side.changed",
  RETIREMENT_DECLARED: "badminton.retirement.declared",
  WALKOVER_DECLARED: "badminton.walkover.declared",
  DISQUALIFICATION_DECLARED: "badminton.disqualification.declared",
} as const;

export type BadmintonEventTypeValue = (typeof BadmintonEventType)[keyof typeof BadmintonEventType];

// ── Payload schemas ─────────────────────────────────────────────────────────

const playerSlotSchema = z.object({
  label: z.string(),
  shortLabel: z.string(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  photoUrl: z.string().optional(),
  flagUrl: z.string().optional(),
  teamColor: z.string().optional(),
  franchiseName: z.string().optional(),
  franchiseLogoUrl: z.string().optional(),
  teamName: z.string().optional(),
  teamLogoUrl: z.string().optional(),
  sponsorName: z.string().optional(),
  sponsorLogoUrl: z.string().optional(),
  masterPlayerId: z.string().optional(),
});

const sideInfoSchema = z.object({
  label: z.string(),
  shortLabel: z.string(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  photoUrl: z.string().optional(),
  flagUrl: z.string().optional(),
  teamColor: z.string().optional(),
  franchiseName: z.string().optional(),
  franchiseLogoUrl: z.string().optional(),
  teamName: z.string().optional(),
  teamLogoUrl: z.string().optional(),
  sponsorName: z.string().optional(),
  sponsorLogoUrl: z.string().optional(),
  masterPlayerId: z.string().optional(),
  playerIds: z.array(z.number()),
  players: z.array(playerSlotSchema).optional(),
});

const formatSchema = z.object({
  totalGames: z.number(),
  pointsPerGame: z.number(),
  deuceAt: z.number(),
  maxPoints: z.number(),
  midGameSideChange: z.boolean(),
});

// ── Payload types ────────────────────────────────────────────────────────────

const doublesSetupSchema = z.object({
  tossWinnerSide: z.enum(["left", "right"]),
  tossDecision: z.enum(["serve", "receive"]),
  firstServingSide: z.enum(["left", "right"]),
  firstServerPlayerIndex: z.union([z.literal(0), z.literal(1)]),
  firstReceivingSide: z.enum(["left", "right"]),
  firstReceiverPlayerIndex: z.union([z.literal(0), z.literal(1)]),
});

const courtPositionsSchema = z.object({
  left: z.object({ rightCourtPlayerIndex: z.union([z.literal(0), z.literal(1)]) }),
  right: z.object({ rightCourtPlayerIndex: z.union([z.literal(0), z.literal(1)]) }),
});

const doublesServeSnapshotSchema = z.object({
  servingSide: z.enum(["left", "right"]),
  servingPlayerIndex: z.union([z.literal(0), z.literal(1)]),
  receivingSide: z.enum(["left", "right"]),
  receivingPlayerIndex: z.union([z.literal(0), z.literal(1)]),
  courtPositions: courtPositionsSchema,
});

export type BadmintonMatchStartedPayload = {
  matchKind: BadmintonMatchKind;
  format: BadmintonMatchFormat;
  leftSide: BadmintonSideInfo;
  rightSide: BadmintonSideInfo;
  /** Which side serves first (singles) or initial serving pair side (doubles). */
  firstServer: BadmintonSide;
  /** Doubles / mixed doubles — toss + first server/receiver selection. */
  doublesSetup?: {
    tossWinnerSide: BadmintonSide;
    tossDecision: "serve" | "receive";
    firstServingSide: BadmintonSide;
    firstServerPlayerIndex: 0 | 1;
    firstReceivingSide: BadmintonSide;
    firstReceiverPlayerIndex: 0 | 1;
  };
  courtNumber?: string;
  matchLabel?: string;
};

export type BadmintonPointWonPayload = {
  /** Side that won the rally point. */
  winningSide: BadmintonSide;
  /** Game number (1-indexed). */
  gameNumber: number;
  /** Score of winning side after this point. */
  winnerScore: number;
  /** Score of other side. */
  loserScore: number;
  /** Optional rally length (number of strokes). */
  rallyLength?: number;
  /** Is this point the game winner? */
  isGamePoint: boolean;
  /** Is this point the match winner? */
  isMatchPoint: boolean;
  /** Side serving after this point (singles: rally winner). */
  servingSide?: BadmintonSide;
  /** Doubles — full post-rally serve/receive/court state. */
  doublesServe?: {
    servingSide: BadmintonSide;
    servingPlayerIndex: 0 | 1;
    receivingSide: BadmintonSide;
    receivingPlayerIndex: 0 | 1;
    courtPositions: {
      left: { rightCourtPlayerIndex: 0 | 1 };
      right: { rightCourtPlayerIndex: 0 | 1 };
    };
  };
};

export type BadmintonPointUndonePayload = {
  /** Sequence of the event being undone. */
  undoneSequence: number;
};

export type BadmintonGameEndedPayload = {
  gameNumber: number;
  winningSide: BadmintonSide;
  leftScore: number;
  rightScore: number;
  /** Next game's initial serving side. */
  nextServingSide?: BadmintonSide;
  /** Doubles — next game server/receiver and court layout. */
  doublesServe?: {
    nextServingSide: BadmintonSide;
    nextServerPlayerIndex: 0 | 1;
    nextReceiverPlayerIndex: 0 | 1;
    courtPositions: {
      left: { rightCourtPlayerIndex: 0 | 1 };
      right: { rightCourtPlayerIndex: 0 | 1 };
    };
    lastServingSide: BadmintonSide;
    lastServerPlayerIndex: 0 | 1;
    lastRallyWinningSide: BadmintonSide;
  };
};

export type BadmintonMatchEndedPayload = {
  winningSide: BadmintonSide;
  gamesLeft: number;
  gamesRight: number;
  reason: "normal" | "walkover" | "retirement" | "disqualification" | "abandoned";
  resultSummary?: string;
};

export type BadmintonIntervalStartedPayload = {
  gameNumber: number;
  /** Score at which interval was triggered (typically 11). */
  atScore: number;
  side: BadmintonSide;
};

export type BadmintonIntervalEndedPayload = {
  gameNumber: number;
};

export type BadmintonTimeoutStartedPayload = {
  side: BadmintonSide;
  /** Timeout type. */
  kind: "regular" | "medical";
};

export type BadmintonTimeoutEndedPayload = {
  side: BadmintonSide;
};

export type BadmintonSideChangedPayload = {
  gameNumber: number;
  /** Which side is now on which end. */
  leftSide: "original_left" | "original_right";
  rightSide: "original_left" | "original_right";
};

export type BadmintonRetirementPayload = {
  /** Side that retired. */
  retiringSide: BadmintonSide;
  winningSide: BadmintonSide;
  reason?: string;
};

export type BadmintonWalkoverPayload = {
  winningSide: BadmintonSide;
  reason?: string;
};

export type BadmintonDisqualificationPayload = {
  disqualifiedSide: BadmintonSide;
  winningSide: BadmintonSide;
  reason?: string;
};

// ── Payload parse helpers ────────────────────────────────────────────────────

const matchStartedSchema = z.object({
  matchKind: z.enum(["singles", "doubles", "mixed_doubles"]),
  format: formatSchema,
  leftSide: sideInfoSchema,
  rightSide: sideInfoSchema,
  firstServer: z.enum(["left", "right"]),
  doublesSetup: doublesSetupSchema.optional(),
  courtNumber: z.string().optional(),
  matchLabel: z.string().optional(),
});

const pointWonSchema = z.object({
  winningSide: z.enum(["left", "right"]),
  gameNumber: z.number(),
  winnerScore: z.number(),
  loserScore: z.number(),
  rallyLength: z.number().optional(),
  isGamePoint: z.boolean(),
  isMatchPoint: z.boolean(),
  servingSide: z.enum(["left", "right"]).optional(),
  doublesServe: doublesServeSnapshotSchema.optional(),
});

const pointUndoneSchema = z.object({
  undoneSequence: z.number(),
});

const gameEndedSchema = z.object({
  gameNumber: z.number(),
  winningSide: z.enum(["left", "right"]),
  leftScore: z.number(),
  rightScore: z.number(),
  nextServingSide: z.enum(["left", "right"]).optional(),
  doublesServe: doublesServeSnapshotSchema
    .extend({
      nextServingSide: z.enum(["left", "right"]),
      nextServerPlayerIndex: z.union([z.literal(0), z.literal(1)]),
      nextReceiverPlayerIndex: z.union([z.literal(0), z.literal(1)]),
      lastServingSide: z.enum(["left", "right"]),
      lastServerPlayerIndex: z.union([z.literal(0), z.literal(1)]),
      lastRallyWinningSide: z.enum(["left", "right"]),
    })
    .optional(),
});

const matchEndedSchema = z.object({
  winningSide: z.enum(["left", "right"]),
  gamesLeft: z.number(),
  gamesRight: z.number(),
  reason: z.enum(["normal", "walkover", "retirement", "disqualification", "abandoned"]),
  resultSummary: z.string().optional(),
});

const intervalStartedSchema = z.object({
  gameNumber: z.number(),
  atScore: z.number(),
  side: z.enum(["left", "right"]),
});

const intervalEndedSchema = z.object({
  gameNumber: z.number(),
});

const timeoutStartedSchema = z.object({
  side: z.enum(["left", "right"]),
  kind: z.enum(["regular", "medical"]),
});

const timeoutEndedSchema = z.object({
  side: z.enum(["left", "right"]),
});

const retirementSchema = z.object({
  retiringSide: z.enum(["left", "right"]),
  winningSide: z.enum(["left", "right"]),
  reason: z.string().optional(),
});

const walkoverSchema = z.object({
  winningSide: z.enum(["left", "right"]),
  reason: z.string().optional(),
});

const disqualificationSchema = z.object({
  disqualifiedSide: z.enum(["left", "right"]),
  winningSide: z.enum(["left", "right"]),
  reason: z.string().optional(),
});

const sideChangedSchema = z.object({
  gameNumber: z.number(),
  leftSide: z.enum(["original_left", "original_right"]),
  rightSide: z.enum(["original_left", "original_right"]),
});

type ParseResult<T> =
  | { ok: true; eventType: string; payload: T }
  | { ok: false; error: string };

function parseWith<T>(
  schema: z.ZodType<T>,
  eventType: string,
  data: unknown,
): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, eventType, payload: result.data };
  }
  return { ok: false, error: result.error.message };
}

export function parseBadmintonEventPayload(
  eventType: string,
  data: unknown,
): ParseResult<unknown> {
  switch (eventType) {
    case BadmintonEventType.MATCH_STARTED:
      return parseWith(matchStartedSchema, eventType, data);
    case BadmintonEventType.POINT_WON:
      return parseWith(pointWonSchema, eventType, data);
    case BadmintonEventType.POINT_UNDONE:
      return parseWith(pointUndoneSchema, eventType, data);
    case BadmintonEventType.GAME_ENDED:
      return parseWith(gameEndedSchema, eventType, data);
    case BadmintonEventType.MATCH_ENDED:
      return parseWith(matchEndedSchema, eventType, data);
    case BadmintonEventType.INTERVAL_STARTED:
      return parseWith(intervalStartedSchema, eventType, data);
    case BadmintonEventType.INTERVAL_ENDED:
      return parseWith(intervalEndedSchema, eventType, data);
    case BadmintonEventType.TIMEOUT_STARTED:
      return parseWith(timeoutStartedSchema, eventType, data);
    case BadmintonEventType.TIMEOUT_ENDED:
      return parseWith(timeoutEndedSchema, eventType, data);
    case BadmintonEventType.SIDE_CHANGED:
      return parseWith(sideChangedSchema, eventType, data);
    case BadmintonEventType.RETIREMENT_DECLARED:
      return parseWith(retirementSchema, eventType, data);
    case BadmintonEventType.WALKOVER_DECLARED:
      return parseWith(walkoverSchema, eventType, data);
    case BadmintonEventType.DISQUALIFICATION_DECLARED:
      return parseWith(disqualificationSchema, eventType, data);
    default:
      return { ok: false, error: `Unknown event type: ${eventType}` };
  }
}
