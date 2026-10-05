/**
 * Canonical sync snapshot — fields every badminton display surface must agree on.
 * Used by realtime sync audits and cross-screen consistency tests.
 */
import { currentReceiverLabel, currentServerLabel, getCourtQuadrantPlayers, sideInfoFor, } from "./scoring/display-utils";
function singlesServerLabel(state) {
    return sideInfoFor(state, state.servingSide).shortLabel;
}
function singlesReceiverLabel(state) {
    const receivingSide = state.servingSide === "left" ? "right" : "left";
    return sideInfoFor(state, receivingSide).shortLabel;
}
/** Extract the cross-screen fields operator, OBS, scoreboard, and broadcast display must match. */
export function extractSyncSnapshot(state) {
    const court = getCourtQuadrantPlayers(state);
    const courtPositions = court
        ? [
            court.topLeft,
            court.topRight,
            court.bottomLeft,
            court.bottomRight,
        ]
        : null;
    const server = state.doublesServe != null ? currentServerLabel(state) : singlesServerLabel(state);
    const receiver = state.doublesServe != null ? currentReceiverLabel(state) : singlesReceiverLabel(state);
    return {
        sequence: state.lastSequence,
        leftScore: state.leftScore,
        rightScore: state.rightScore,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        currentGame: state.currentGame,
        servingSide: state.servingSide,
        server,
        receiver,
        courtPositions,
        matchStatus: state.matchStatus,
        totalRallies: state.totalRallies,
        isPaused: state.isPaused,
        pauseReason: state.pauseReason,
        pauseDetail: state.pauseDetail,
    };
}
export function syncSnapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
export function diffSyncSnapshots(a, b) {
    const mismatches = [];
    const keys = Object.keys(a);
    for (const key of keys) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
            mismatches.push(`${String(key)}: ${JSON.stringify(a[key])} vs ${JSON.stringify(b[key])}`);
        }
    }
    return mismatches;
}
