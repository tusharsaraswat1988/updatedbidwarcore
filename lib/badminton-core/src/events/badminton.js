import { z } from "zod";
export const BadmintonEventType = {
    MATCH_STARTED: "badminton.match.started",
    /** Re-apply toss / first serve / court ends while still 0–0 (after undos). */
    TOSS_CORRECTED: "badminton.toss.corrected",
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
    MATCH_PAUSED: "badminton.match.paused",
    MATCH_RESUMED: "badminton.match.resumed",
    MATCH_NOTE_ADDED: "badminton.match.note.added",
    /** Update/set winner margin when no completed games exist. */
    MARGIN_POINTS_ASSIGNED: "badminton.margin_points.assigned",
    /** Admin correction of final game scores after completion. */
    SCORE_REVISED: "badminton.score.revised",
    /** Re-open a finished match for further scoring / undo. */
    MATCH_REOPENED: "badminton.match.reopened",
};
// ── Payload schemas ─────────────────────────────────────────────────────────
const playerSlotSchema = z.object({
    label: z.string(),
    shortLabel: z.string(),
    countryCode: z.string().nullish(),
    countryName: z.string().nullish(),
    photoUrl: z.string().nullish(),
    flagUrl: z.string().nullish(),
    teamColor: z.string().nullish(),
    franchiseName: z.string().nullish(),
    franchiseLogoUrl: z.string().nullish(),
    teamName: z.string().nullish(),
    teamLogoUrl: z.string().nullish(),
    sponsorName: z.string().nullish(),
    sponsorLogoUrl: z.string().nullish(),
    masterPlayerId: z.string().nullish(),
});
const sideInfoSchema = z.object({
    label: z.string(),
    shortLabel: z.string(),
    countryCode: z.string().nullish(),
    countryName: z.string().nullish(),
    photoUrl: z.string().nullish(),
    flagUrl: z.string().nullish(),
    teamColor: z.string().nullish(),
    franchiseName: z.string().nullish(),
    franchiseLogoUrl: z.string().nullish(),
    teamName: z.string().nullish(),
    teamLogoUrl: z.string().nullish(),
    sponsorName: z.string().nullish(),
    sponsorLogoUrl: z.string().nullish(),
    masterPlayerId: z.string().nullish(),
    playerIds: z.array(z.number()),
    players: z.array(playerSlotSchema).nullish(),
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
const tossCorrectedSchema = z.object({
    leftSide: sideInfoSchema,
    rightSide: sideInfoSchema,
    firstServer: z.enum(["left", "right"]),
    doublesSetup: doublesSetupSchema.optional(),
    endsSwapped: z.boolean(),
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
    undoneSequences: z.array(z.number()).optional(),
});
const gameEndedDoublesServeSchema = z.object({
    nextServingSide: z.enum(["left", "right"]),
    nextServerPlayerIndex: z.union([z.literal(0), z.literal(1)]),
    nextReceiverPlayerIndex: z.union([z.literal(0), z.literal(1)]),
    courtPositions: courtPositionsSchema,
    lastServingSide: z.enum(["left", "right"]),
    lastServerPlayerIndex: z.union([z.literal(0), z.literal(1)]),
    lastRallyWinningSide: z.enum(["left", "right"]),
});
const gameEndedSchema = z.object({
    gameNumber: z.number(),
    winningSide: z.enum(["left", "right"]),
    leftScore: z.number(),
    rightScore: z.number(),
    nextServingSide: z.enum(["left", "right"]).optional(),
    doublesServe: gameEndedDoublesServeSchema.optional(),
});
const assignedMarginPointsSchema = z.number().int().positive().optional();
const matchEndedSchema = z.object({
    winningSide: z.enum(["left", "right"]),
    gamesLeft: z.number(),
    gamesRight: z.number(),
    reason: z.enum(["normal", "walkover", "retirement", "disqualification", "abandoned"]),
    resultSummary: z.string().optional(),
    assignedMarginPoints: assignedMarginPointsSchema,
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
    assignedMarginPoints: assignedMarginPointsSchema,
});
const walkoverSchema = z.object({
    winningSide: z.enum(["left", "right"]),
    reason: z.string().optional(),
    assignedMarginPoints: assignedMarginPointsSchema,
});
const disqualificationSchema = z.object({
    disqualifiedSide: z.enum(["left", "right"]),
    winningSide: z.enum(["left", "right"]),
    reason: z.string().min(1),
    assignedMarginPoints: assignedMarginPointsSchema,
});
const marginPointsAssignedSchema = z.object({
    assignedMarginPoints: z.number().int().positive(),
});
const matchPausedSchema = z.object({
    reason: z.enum(["medical", "technical_issue", "weather", "court_issue", "ops_hold", "other"]),
    detail: z.string().optional(),
});
const matchResumedSchema = z.object({
    reason: z.string().optional(),
});
const matchNoteAddedSchema = z.object({
    text: z.string().min(1),
});
const scoreRevisedSchema = z.object({
    games: z
        .array(z.object({
        gameNumber: z.number().int().positive(),
        leftScore: z.number().int().nonnegative(),
        rightScore: z.number().int().nonnegative(),
        winningSide: z.enum(["left", "right"]),
    }))
        .min(1)
        .max(5),
    winningSide: z.enum(["left", "right"]),
    note: z.string().optional(),
});
const matchReopenedSchema = z.object({
    note: z.string().optional(),
});
const sideChangedSchema = z.object({
    gameNumber: z.number(),
    leftSide: z.enum(["original_left", "original_right"]),
    rightSide: z.enum(["original_left", "original_right"]),
});
function parseWith(schema, eventType, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { ok: true, eventType, payload: result.data };
    }
    return { ok: false, error: result.error.message };
}
export function parseBadmintonEventPayload(eventType, data) {
    switch (eventType) {
        case BadmintonEventType.MATCH_STARTED:
            return parseWith(matchStartedSchema, eventType, data);
        case BadmintonEventType.TOSS_CORRECTED:
            return parseWith(tossCorrectedSchema, eventType, data);
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
        case BadmintonEventType.MATCH_PAUSED:
            return parseWith(matchPausedSchema, eventType, data);
        case BadmintonEventType.MATCH_RESUMED:
            return parseWith(matchResumedSchema, eventType, data);
        case BadmintonEventType.MATCH_NOTE_ADDED:
            return parseWith(matchNoteAddedSchema, eventType, data);
        case BadmintonEventType.MARGIN_POINTS_ASSIGNED:
            return parseWith(marginPointsAssignedSchema, eventType, data);
        case BadmintonEventType.SCORE_REVISED:
            return parseWith(scoreRevisedSchema, eventType, data);
        case BadmintonEventType.MATCH_REOPENED:
            return parseWith(matchReopenedSchema, eventType, data);
        default:
            return { ok: false, error: `Unknown event type: ${eventType}` };
    }
}
