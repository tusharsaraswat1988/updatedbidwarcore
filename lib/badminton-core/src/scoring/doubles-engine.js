import { BadmintonEventType } from "../events/badminton";
import { advanceDoublesServeAfterPoint, buildInitialCourtPositions, buildNextGameCourtPositions, nextGameServerAfterGameEnd, opposingSide, receiverIndexForServer, } from "./doubles-court";
import { deriveDoublesServeAfterPointWon, validateDoublesServeAgainstPayload, } from "./doubles-replay-derive";
function isDoublesPayload(input) {
    return "doublesSetup" in input && input.doublesSetup != null;
}
function buildDoublesServeState(servingSide, serverPlayerIndex, receivingSide, receiverPlayerIndex, setup) {
    const courtPositions = buildInitialCourtPositions(servingSide, serverPlayerIndex, receivingSide, receiverPlayerIndex);
    return {
        servingSide,
        servingPlayerIndex: serverPlayerIndex,
        receivingSide,
        receivingPlayerIndex: receiverPlayerIndex,
        courtPositions,
        setup,
    };
}
export class DoublesScoringEngine {
    kind = "doubles";
    validateStart(state, input) {
        if (state.matchStatus !== "scheduled") {
            return { ok: false, error: "Match is not in scheduled status" };
        }
        if (!isDoublesPayload(input)) {
            return { ok: false, error: "Doubles matches require doublesSetup (toss, server, receiver)" };
        }
        const { doublesSetup } = input;
        if (doublesSetup.firstServingSide === doublesSetup.firstReceivingSide) {
            return { ok: false, error: "Serving and receiving sides must be different" };
        }
        return { ok: true };
    }
    buildMatchStartedEvents(_state, input) {
        return [
            {
                eventType: BadmintonEventType.MATCH_STARTED,
                payload: input,
            },
        ];
    }
    buildPointWonPayload(state, winningSide, scores, opts) {
        const ds = state.doublesServe;
        if (!ds) {
            throw new Error("Doubles serve state missing");
        }
        const next = advanceDoublesServeAfterPoint(winningSide, ds.servingSide, scores.newLeftScore, scores.newRightScore, ds.courtPositions);
        return {
            winningSide,
            gameNumber: state.currentGame,
            winnerScore: scores.winnerScore,
            loserScore: scores.loserScore,
            rallyLength: opts?.rallyLength,
            isGamePoint: scores.gameOver,
            isMatchPoint: scores.matchOver,
            servingSide: next.servingSide,
            doublesServe: {
                servingSide: next.servingSide,
                servingPlayerIndex: next.servingPlayerIndex,
                receivingSide: next.receivingSide,
                receivingPlayerIndex: next.receivingPlayerIndex,
                courtPositions: next.courtPositions,
            },
        };
    }
    buildGameEndedExtras(state, winningSide, _newLeftScore, _newRightScore) {
        const ds = state.doublesServe;
        if (!ds) {
            return { nextServingSide: winningSide };
        }
        const lastServingSide = ds.servingSide;
        const lastServerPlayerIndex = ds.servingPlayerIndex;
        const lastRallyWinningSide = winningSide;
        const nextServerIndex = nextGameServerAfterGameEnd(winningSide, lastServingSide, lastServerPlayerIndex, lastRallyWinningSide);
        const courtPositions = buildNextGameCourtPositions(winningSide, nextServerIndex, ds.courtPositions.left, ds.courtPositions.right);
        const receivingSide = opposingSide(winningSide);
        const nextReceiverIndex = receiverIndexForServer(nextServerIndex, courtPositions[winningSide], courtPositions[receivingSide]);
        return {
            nextServingSide: winningSide,
            doublesServe: {
                nextServingSide: winningSide,
                nextServerPlayerIndex: nextServerIndex,
                nextReceiverPlayerIndex: nextReceiverIndex,
                courtPositions,
                lastServingSide,
                lastServerPlayerIndex,
                lastRallyWinningSide,
            },
        };
    }
    applyMatchStarted(_state, payload) {
        if (!isDoublesPayload(payload)) {
            return {};
        }
        const { doublesSetup } = payload;
        const doublesServe = buildDoublesServeState(doublesSetup.firstServingSide, doublesSetup.firstServerPlayerIndex, doublesSetup.firstReceivingSide, doublesSetup.firstReceiverPlayerIndex, {
            firstServingSide: doublesSetup.firstServingSide,
            firstServerPlayerIndex: doublesSetup.firstServerPlayerIndex,
            firstReceivingSide: doublesSetup.firstReceivingSide,
            firstReceiverPlayerIndex: doublesSetup.firstReceiverPlayerIndex,
        });
        return {
            servingSide: doublesServe.servingSide,
            doublesServe,
        };
    }
    applyPointWon(state, payload) {
        const derived = deriveDoublesServeAfterPointWon(state, payload);
        if (!derived) {
            return { servingSide: payload.servingSide ?? payload.winningSide };
        }
        validateDoublesServeAgainstPayload(derived, payload.doublesServe);
        return {
            servingSide: derived.servingSide,
            doublesServe: derived,
        };
    }
    applyGameEnded(state, payload) {
        const extras = payload.doublesServe;
        if (!extras) {
            return { servingSide: payload.nextServingSide ?? payload.winningSide };
        }
        const doublesServe = {
            setup: state.doublesServe?.setup ?? {
                firstServingSide: extras.nextServingSide,
                firstServerPlayerIndex: extras.nextServerPlayerIndex,
                firstReceivingSide: opposingSide(extras.nextServingSide),
                firstReceiverPlayerIndex: extras.nextReceiverPlayerIndex,
            },
            servingSide: extras.nextServingSide,
            servingPlayerIndex: extras.nextServerPlayerIndex,
            receivingSide: opposingSide(extras.nextServingSide),
            receivingPlayerIndex: extras.nextReceiverPlayerIndex,
            courtPositions: extras.courtPositions,
            lastGameEnd: {
                lastServingSide: extras.lastServingSide,
                lastServerPlayerIndex: extras.lastServerPlayerIndex,
                lastRallyWinningSide: extras.lastRallyWinningSide,
            },
        };
        return {
            servingSide: extras.nextServingSide,
            doublesServe,
        };
    }
}
export class MixedDoublesScoringEngine extends DoublesScoringEngine {
    kind = "mixed_doubles";
}
export const doublesScoringEngine = new DoublesScoringEngine();
export const mixedDoublesScoringEngine = new MixedDoublesScoringEngine();
