import { BadmintonEventType } from "../events/badminton";
import { deriveSinglesServingSideAfterPointWon, validateSinglesServingSideAgainstPayload, } from "./singles-replay-derive";
export class SinglesScoringEngine {
    kind = "singles";
    validateStart(state, _input) {
        if (state.matchStatus !== "scheduled") {
            return { ok: false, error: "Match is not in scheduled status" };
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
        return {
            winningSide,
            gameNumber: state.currentGame,
            winnerScore: scores.winnerScore,
            loserScore: scores.loserScore,
            rallyLength: opts?.rallyLength,
            isGamePoint: scores.gameOver,
            isMatchPoint: scores.matchOver,
            // Singles: server is always the rally winner.
            servingSide: winningSide,
        };
    }
    buildGameEndedExtras(_state, winningSide, _newLeftScore, _newRightScore) {
        return { nextServingSide: winningSide };
    }
    applyMatchStarted(_state, payload) {
        return {
            servingSide: payload.firstServer,
            doublesServe: undefined,
        };
    }
    applyPointWon(_state, payload) {
        const servingSide = deriveSinglesServingSideAfterPointWon(payload);
        validateSinglesServingSideAgainstPayload(servingSide, payload);
        return { servingSide };
    }
    applyGameEnded(_state, payload) {
        const nextServingSide = payload.nextServingSide ?? payload.winningSide;
        return { servingSide: nextServingSide };
    }
}
export const singlesScoringEngine = new SinglesScoringEngine();
