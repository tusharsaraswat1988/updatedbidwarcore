import { BadmintonEventType, parseBadmintonEventPayload, } from "../events/badminton";
import { isBadmintonTerminalMatchStatus } from "../match-terminal-status";
import { createInitialBadmintonState, gamesNeededToWin, isDecidingGame, sideChangeScore, } from "./state";
import { getScoringEngine } from "../scoring";
import { deriveSinglesScoresAfterPointWon, validateSinglesScoresAgainstPayload, } from "../scoring/singles-replay-derive";
import { deriveDoublesScoresAfterPointWon, validateDoublesScoresAgainstPayload, } from "../scoring/doubles-replay-derive";
class InvalidEventPayloadError extends Error {
    constructor(eventType, detail) {
        super(`Invalid payload for ${eventType}: ${detail}`);
        this.name = "InvalidEventPayloadError";
    }
}
function applyMatchStarted(state, payload) {
    const firstGame = {
        gameNumber: 1,
        leftScore: 0,
        rightScore: 0,
        servingSide: payload.firstServer,
        intervalReached: false,
        sideChangeAcknowledged: false,
        phase: "in_progress",
        startedAt: new Date().toISOString(),
    };
    const engine = getScoringEngine(payload.matchKind);
    const enginePatch = engine.applyMatchStarted(state, payload);
    return {
        ...state,
        matchStatus: "live",
        matchKind: payload.matchKind,
        format: payload.format,
        leftSide: payload.leftSide,
        rightSide: payload.rightSide,
        currentGame: 1,
        leftScore: 0,
        rightScore: 0,
        games: [firstGame],
        servingSide: enginePatch.servingSide ?? payload.firstServer,
        doublesServe: enginePatch.doublesServe,
        gamesLeft: 0,
        gamesRight: 0,
        inInterval: false,
        activeTimeout: null,
        isPaused: false,
        matchNotes: [],
        startedAt: new Date().toISOString(),
    };
}
function applyTossCorrected(state, payload) {
    const startLike = {
        matchKind: state.matchKind,
        format: state.format,
        leftSide: payload.leftSide,
        rightSide: payload.rightSide,
        firstServer: payload.firstServer,
        doublesSetup: payload.doublesSetup,
    };
    const engine = getScoringEngine(state.matchKind);
    const enginePatch = engine.applyMatchStarted(state, startLike);
    const game0 = state.games[0];
    return {
        ...state,
        leftSide: payload.leftSide,
        rightSide: payload.rightSide,
        leftScore: 0,
        rightScore: 0,
        servingSide: enginePatch.servingSide ?? payload.firstServer,
        doublesServe: enginePatch.doublesServe,
        games: game0
            ? [
                {
                    ...game0,
                    leftScore: 0,
                    rightScore: 0,
                    servingSide: payload.firstServer,
                    intervalReached: false,
                    sideChangeAcknowledged: false,
                    phase: "in_progress",
                },
            ]
            : state.games,
    };
}
function applyPointWon(state, payload) {
    if (state.matchStatus !== "live")
        return state;
    if (payload.gameNumber !== state.currentGame)
        return state;
    const { newLeftScore, newRightScore } = state.matchKind === "singles"
        ? (() => {
            const derived = deriveSinglesScoresAfterPointWon(state, payload);
            validateSinglesScoresAgainstPayload(derived, payload);
            return derived;
        })()
        : (() => {
            // Doubles must derive scores too — trusting payload winnerScore/loserScore
            // let a stale command prior poison the event log (3-0 then a 1-0 payload
            // rewound the displayed score on the next continuous left-side point).
            const derived = deriveDoublesScoresAfterPointWon(state, payload);
            validateDoublesScoresAgainstPayload(derived, payload);
            return derived;
        })();
    const nextServingSide = state.matchKind === "singles"
        ? payload.winningSide
        : payload.servingSide ?? payload.winningSide;
    const updatedGames = state.games.map((g) => {
        if (g.gameNumber !== payload.gameNumber)
            return g;
        return {
            ...g,
            leftScore: newLeftScore,
            rightScore: newRightScore,
            servingSide: nextServingSide,
            // Deciding-game interval / end-change (BWF: 11 in a game of 21).
            intervalReached: g.intervalReached ||
                (state.format.midGameSideChange &&
                    isDecidingGame(payload.gameNumber, state.format.totalGames) &&
                    !g.intervalReached &&
                    Math.max(newLeftScore, newRightScore) >=
                        sideChangeScore(state.format.pointsPerGame)),
        };
    });
    const engine = getScoringEngine(state.matchKind);
    const enginePatch = engine.applyPointWon(state, payload);
    return {
        ...state,
        leftScore: newLeftScore,
        rightScore: newRightScore,
        servingSide: enginePatch.servingSide ?? nextServingSide,
        doublesServe: enginePatch.doublesServe ?? state.doublesServe,
        games: updatedGames,
        totalRallies: state.totalRallies + 1,
    };
}
function applyGameEnded(state, payload) {
    const newGamesLeft = payload.winningSide === "left" ? state.gamesLeft + 1 : state.gamesLeft;
    const newGamesRight = payload.winningSide === "right" ? state.gamesRight + 1 : state.gamesRight;
    const updatedGames = state.games.map((g) => {
        if (g.gameNumber !== payload.gameNumber)
            return g;
        return {
            ...g,
            leftScore: payload.leftScore,
            rightScore: payload.rightScore,
            phase: "completed",
            winner: payload.winningSide,
            endedAt: new Date().toISOString(),
        };
    });
    const gamesNeeded = gamesNeededToWin(state.format.totalGames);
    const isMatchOver = newGamesLeft >= gamesNeeded || newGamesRight >= gamesNeeded;
    if (isMatchOver) {
        return {
            ...state,
            gamesLeft: newGamesLeft,
            gamesRight: newGamesRight,
            leftScore: payload.leftScore,
            rightScore: payload.rightScore,
            games: updatedGames,
            inInterval: false,
        };
    }
    const nextGameNumber = payload.gameNumber + 1;
    const nextServingSide = payload.nextServingSide ?? payload.winningSide;
    const engine = getScoringEngine(state.matchKind);
    const enginePatch = engine.applyGameEnded(state, payload);
    const nextGame = {
        gameNumber: nextGameNumber,
        leftScore: 0,
        rightScore: 0,
        servingSide: enginePatch.servingSide ?? nextServingSide,
        intervalReached: false,
        sideChangeAcknowledged: false,
        phase: "in_progress",
        startedAt: new Date().toISOString(),
    };
    return {
        ...state,
        gamesLeft: newGamesLeft,
        gamesRight: newGamesRight,
        currentGame: nextGameNumber,
        leftScore: 0,
        rightScore: 0,
        games: [...updatedGames, nextGame],
        servingSide: enginePatch.servingSide ?? nextServingSide,
        doublesServe: enginePatch.doublesServe ?? state.doublesServe,
        inInterval: false,
    };
}
function applyMatchEnded(state, payload) {
    // Map reason to the appropriate terminal match status.
    const statusByReason = {
        normal: "completed",
        walkover: "walkover",
        retirement: "retired",
        disqualification: "disqualified",
        abandoned: "abandoned",
    };
    return {
        ...state,
        matchStatus: statusByReason[payload.reason] ?? "completed",
        winnerSide: payload.winningSide,
        gamesLeft: payload.gamesLeft,
        gamesRight: payload.gamesRight,
        resultReason: payload.reason,
        ...(payload.assignedMarginPoints != null
            ? { assignedMarginPoints: payload.assignedMarginPoints }
            : {}),
        inInterval: false,
        activeTimeout: null,
        isPaused: false,
        endedAt: new Date().toISOString(),
    };
}
function applyIntervalStarted(state, _payload) {
    return { ...state, inInterval: true };
}
function applyIntervalEnded(state, _payload) {
    return { ...state, inInterval: false };
}
function applyTimeoutStarted(state, payload) {
    return {
        ...state,
        activeTimeout: { side: payload.side, takenAt: new Date().toISOString() },
    };
}
function applyTimeoutEnded(state, _payload) {
    return { ...state, activeTimeout: null };
}
function applySideChanged(state, payload) {
    const gameNumber = payload.gameNumber;
    return {
        ...state,
        games: state.games.map((g) => g.gameNumber === gameNumber ? { ...g, sideChangeAcknowledged: true } : g),
    };
}
function applyRetirement(state, payload) {
    const margin = payload.assignedMarginPoints;
    const hasScoredGame = state.games.some((g) => g.phase === "completed" || Boolean(g.winner));
    const scorePatch = !hasScoredGame &&
        margin != null &&
        Number.isInteger(margin) &&
        margin > 0
        ? {
            leftScore: payload.winningSide === "left" ? margin : 0,
            rightScore: payload.winningSide === "right" ? margin : 0,
        }
        : {};
    return {
        ...state,
        matchStatus: "retired",
        winnerSide: payload.winningSide,
        resultReason: "retirement",
        ...scorePatch,
        ...(margin != null ? { assignedMarginPoints: margin } : {}),
    };
}
function applyWalkover(state, payload) {
    const margin = payload.assignedMarginPoints;
    const hasScoredGame = state.games.some((g) => g.phase === "completed" || Boolean(g.winner));
    // Surface assigned margin on the scoreboard when no games were played
    // (list/mission-control UIs read leftScore/rightScore).
    const scorePatch = !hasScoredGame &&
        margin != null &&
        Number.isInteger(margin) &&
        margin > 0
        ? {
            leftScore: payload.winningSide === "left" ? margin : 0,
            rightScore: payload.winningSide === "right" ? margin : 0,
        }
        : {};
    return {
        ...state,
        matchStatus: "walkover",
        winnerSide: payload.winningSide,
        resultReason: "walkover",
        ...scorePatch,
        ...(margin != null ? { assignedMarginPoints: margin } : {}),
    };
}
function applyDisqualification(state, payload) {
    const margin = payload.assignedMarginPoints;
    const hasScoredGame = state.games.some((g) => g.phase === "completed" || Boolean(g.winner));
    const scorePatch = !hasScoredGame &&
        margin != null &&
        Number.isInteger(margin) &&
        margin > 0
        ? {
            leftScore: payload.winningSide === "left" ? margin : 0,
            rightScore: payload.winningSide === "right" ? margin : 0,
        }
        : {};
    return {
        ...state,
        matchStatus: "disqualified",
        winnerSide: payload.winningSide,
        resultReason: "disqualification",
        isPaused: false,
        ...scorePatch,
        ...(margin != null ? { assignedMarginPoints: margin } : {}),
    };
}
function applyMarginPointsAssigned(state, payload) {
    const margin = payload.assignedMarginPoints;
    const hasScoredGame = state.games.some((g) => g.phase === "completed" || Boolean(g.winner));
    const scorePatch = !hasScoredGame &&
        state.winnerSide &&
        Number.isInteger(margin) &&
        margin > 0
        ? {
            leftScore: state.winnerSide === "left" ? margin : 0,
            rightScore: state.winnerSide === "right" ? margin : 0,
        }
        : {};
    return {
        ...state,
        assignedMarginPoints: margin,
        ...scorePatch,
    };
}
function applyMatchPaused(state, payload) {
    return {
        ...state,
        matchStatus: payload.reason === "ops_hold" ? "on_hold" : "paused",
        isPaused: true,
        pauseReason: payload.reason,
        pauseDetail: payload.detail,
    };
}
function applyMatchResumed(state, _payload) {
    return {
        ...state,
        matchStatus: "live",
        isPaused: false,
        pauseReason: undefined,
        pauseDetail: undefined,
    };
}
function applyMatchNoteAdded(state, payload, sequence, occurredAt) {
    const ts = occurredAt instanceof Date
        ? occurredAt.toISOString()
        : occurredAt ?? new Date().toISOString();
    return {
        ...state,
        matchNotes: [
            ...state.matchNotes,
            { text: payload.text, addedAt: ts, sequence },
        ],
    };
}
function applyScoreRevised(state, payload, sequence, occurredAt) {
    const ts = occurredAt instanceof Date
        ? occurredAt.toISOString()
        : occurredAt ?? new Date().toISOString();
    const games = payload.games.map((g) => ({
        gameNumber: g.gameNumber,
        leftScore: g.leftScore,
        rightScore: g.rightScore,
        servingSide: g.winningSide,
        intervalReached: false,
        sideChangeAcknowledged: true,
        phase: "completed",
        winner: g.winningSide,
        endedAt: ts,
    }));
    let gamesLeft = 0;
    let gamesRight = 0;
    for (const g of games) {
        if (g.winner === "left")
            gamesLeft += 1;
        else if (g.winner === "right")
            gamesRight += 1;
    }
    const last = games[games.length - 1];
    const noteText = payload.note?.trim() || "Final score revised by director";
    return {
        ...state,
        matchStatus: "completed",
        resultReason: "normal",
        winnerSide: payload.winningSide,
        gamesLeft,
        gamesRight,
        currentGame: last.gameNumber,
        leftScore: last.leftScore,
        rightScore: last.rightScore,
        games,
        isPaused: false,
        pauseReason: undefined,
        pauseDetail: undefined,
        inInterval: false,
        activeTimeout: null,
        endedAt: ts,
        matchNotes: [
            ...state.matchNotes,
            { text: noteText, addedAt: ts, sequence },
        ],
    };
}
function applyMatchReopened(state, payload, sequence, occurredAt) {
    if (!isBadmintonTerminalMatchStatus(state.matchStatus)) {
        return state;
    }
    const ts = occurredAt instanceof Date
        ? occurredAt.toISOString()
        : occurredAt ?? new Date().toISOString();
    const completedGames = state.games.filter((g) => g.phase === "completed");
    const need = gamesNeededToWin(state.format.totalGames);
    const leftWins = completedGames.filter((g) => g.winner === "left").length;
    const rightWins = completedGames.filter((g) => g.winner === "right").length;
    const matchAlreadyWon = leftWins >= need || rightWins >= need;
    let games = [...state.games];
    let currentGame = state.currentGame;
    let leftScore = state.leftScore;
    let rightScore = state.rightScore;
    if (matchAlreadyWon || completedGames.length === state.games.length) {
        // Start a fresh in-progress game after completed set so undo/score can continue.
        const nextNum = completedGames.length + 1;
        games = [
            ...completedGames,
            {
                gameNumber: nextNum,
                leftScore: 0,
                rightScore: 0,
                servingSide: state.servingSide,
                intervalReached: false,
                sideChangeAcknowledged: false,
                phase: "in_progress",
                startedAt: ts,
            },
        ];
        currentGame = nextNum;
        leftScore = 0;
        rightScore = 0;
    }
    else {
        games = state.games.map((g) => g.phase === "completed"
            ? g
            : { ...g, phase: "in_progress", winner: undefined, endedAt: undefined });
    }
    const noteText = payload.note?.trim() || "Match reopened for score correction";
    return {
        ...state,
        matchStatus: "live",
        resultReason: undefined,
        winnerSide: undefined,
        endedAt: undefined,
        isPaused: false,
        pauseReason: undefined,
        pauseDetail: undefined,
        inInterval: false,
        activeTimeout: null,
        games,
        gamesLeft: leftWins,
        gamesRight: rightWins,
        currentGame,
        leftScore,
        rightScore,
        matchNotes: [
            ...state.matchNotes,
            { text: noteText, addedAt: ts, sequence },
        ],
    };
}
export function reduceBadminton(state, event) {
    const parsed = parseBadmintonEventPayload(event.eventType, event.payload);
    if (!parsed.ok) {
        throw new InvalidEventPayloadError(event.eventType, parsed.error);
    }
    let next;
    switch (event.eventType) {
        case BadmintonEventType.MATCH_STARTED:
            next = applyMatchStarted(state, parsed.payload);
            break;
        case BadmintonEventType.TOSS_CORRECTED:
            next = applyTossCorrected(state, parsed.payload);
            break;
        case BadmintonEventType.POINT_WON:
            next = applyPointWon(state, parsed.payload);
            break;
        case BadmintonEventType.POINT_UNDONE:
            // Undo markers are resolved before replay (compensating event pattern)
            throw new InvalidEventPayloadError(BadmintonEventType.POINT_UNDONE, "undo markers are resolved before replay");
        case BadmintonEventType.GAME_ENDED:
            next = applyGameEnded(state, parsed.payload);
            break;
        case BadmintonEventType.MATCH_ENDED:
            next = applyMatchEnded(state, parsed.payload);
            break;
        case BadmintonEventType.INTERVAL_STARTED:
            next = applyIntervalStarted(state, parsed.payload);
            break;
        case BadmintonEventType.INTERVAL_ENDED:
            next = applyIntervalEnded(state, parsed.payload);
            break;
        case BadmintonEventType.TIMEOUT_STARTED:
            next = applyTimeoutStarted(state, parsed.payload);
            break;
        case BadmintonEventType.TIMEOUT_ENDED:
            next = applyTimeoutEnded(state, parsed.payload);
            break;
        case BadmintonEventType.SIDE_CHANGED:
            next = applySideChanged(state, parsed.payload);
            break;
        case BadmintonEventType.RETIREMENT_DECLARED:
            next = applyRetirement(state, parsed.payload);
            break;
        case BadmintonEventType.WALKOVER_DECLARED:
            next = applyWalkover(state, parsed.payload);
            break;
        case BadmintonEventType.DISQUALIFICATION_DECLARED:
            next = applyDisqualification(state, parsed.payload);
            break;
        case BadmintonEventType.MATCH_PAUSED:
            next = applyMatchPaused(state, parsed.payload);
            break;
        case BadmintonEventType.MATCH_RESUMED:
            next = applyMatchResumed(state, parsed.payload);
            break;
        case BadmintonEventType.MATCH_NOTE_ADDED:
            next = applyMatchNoteAdded(state, parsed.payload, event.sequence, event.occurredAt);
            break;
        case BadmintonEventType.MARGIN_POINTS_ASSIGNED:
            next = applyMarginPointsAssigned(state, parsed.payload);
            break;
        case BadmintonEventType.SCORE_REVISED:
            next = applyScoreRevised(state, parsed.payload, event.sequence, event.occurredAt);
            break;
        case BadmintonEventType.MATCH_REOPENED:
            next = applyMatchReopened(state, parsed.payload, event.sequence, event.occurredAt);
            break;
        default:
            throw new InvalidEventPayloadError(event.eventType, "unsupported event type");
    }
    return { ...next, lastSequence: event.sequence };
}
/** Resolve undo markers: remove the event being undone + the undo marker itself. */
export function resolveUndoEvents(events) {
    const undoneSequences = new Set();
    for (const ev of events) {
        if (ev.eventType === BadmintonEventType.POINT_UNDONE) {
            const payload = ev.payload;
            const targets = payload.undoneSequences ?? [payload.undoneSequence];
            for (const seq of targets) {
                undoneSequences.add(seq);
            }
            undoneSequences.add(ev.sequence);
        }
    }
    return events.filter((ev) => !undoneSequences.has(ev.sequence));
}
/** Replay a sequence of events to build the full match state. */
export function replayBadmintonEvents(meta, events) {
    const effective = resolveUndoEvents(events);
    const initial = createInitialBadmintonState(meta);
    return effective.reduce((state, event) => reduceBadminton(state, event), initial);
}
