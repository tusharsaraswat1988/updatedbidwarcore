/**
 * Grade A Phase A — derive doubles serve/court state on replay from rally outcomes.
 * Legacy payloads may still carry doublesServe snapshots; drift is logged, not fatal.
 */
import { advanceDoublesServeAfterPoint } from "./doubles-court";
let driftWarningHandler = null;
/** Optional hook for production drift logging (default: console.warn). */
export function setDoublesServeDriftWarningHandler(handler) {
    driftWarningHandler = handler;
}
function warnDrift(message) {
    if (driftWarningHandler) {
        driftWarningHandler(message);
        return;
    }
    console.warn(`[badminton-core] doublesServe drift: ${message}`);
}
/** Derive post-rally scores from pre-rally state + rally winner (ignore payload scores). */
export function deriveDoublesScoresAfterPointWon(state, payload) {
    return {
        newLeftScore: payload.winningSide === "left" ? state.leftScore + 1 : state.leftScore,
        newRightScore: payload.winningSide === "right" ? state.rightScore + 1 : state.rightScore,
    };
}
function payloadScores(payload) {
    return {
        newLeftScore: payload.winningSide === "left" ? payload.winnerScore : payload.loserScore,
        newRightScore: payload.winningSide === "right" ? payload.winnerScore : payload.loserScore,
    };
}
/** Compare derived scores to legacy payload fields; warn on mismatch. */
export function validateDoublesScoresAgainstPayload(derived, payload) {
    const stored = payloadScores(payload);
    if (derived.newLeftScore === stored.newLeftScore &&
        derived.newRightScore === stored.newRightScore) {
        return true;
    }
    warnDrift(`score derived ${derived.newLeftScore}-${derived.newRightScore} ` +
        `vs payload ${stored.newLeftScore}-${stored.newRightScore} ` +
        `(winner=${payload.winningSide})`);
    return false;
}
/** Derive post-rally doubles serve state from pre-rally state + rally winner. */
export function deriveDoublesServeAfterPointWon(state, payload) {
    const ds = state.doublesServe;
    if (!ds)
        return null;
    const { newLeftScore, newRightScore } = deriveDoublesScoresAfterPointWon(state, payload);
    const next = advanceDoublesServeAfterPoint(payload.winningSide, ds.servingSide, newLeftScore, newRightScore, ds.courtPositions);
    return {
        setup: ds.setup,
        lastGameEnd: ds.lastGameEnd,
        servingSide: next.servingSide,
        servingPlayerIndex: next.servingPlayerIndex,
        receivingSide: next.receivingSide,
        receivingPlayerIndex: next.receivingPlayerIndex,
        courtPositions: next.courtPositions,
    };
}
function snapshotFieldsEqual(derived, stored) {
    return (derived.servingSide === stored.servingSide &&
        derived.servingPlayerIndex === stored.servingPlayerIndex &&
        derived.receivingSide === stored.receivingSide &&
        derived.receivingPlayerIndex === stored.receivingPlayerIndex &&
        derived.courtPositions.left.rightCourtPlayerIndex ===
            stored.courtPositions.left.rightCourtPlayerIndex &&
        derived.courtPositions.right.rightCourtPlayerIndex ===
            stored.courtPositions.right.rightCourtPlayerIndex);
}
/** Compare derived serve state to a legacy payload snapshot; warn on mismatch. */
export function validateDoublesServeAgainstPayload(derived, stored) {
    if (!stored)
        return true;
    if (snapshotFieldsEqual(derived, stored))
        return true;
    warnDrift(`derived server P${derived.servingPlayerIndex}@${derived.servingSide} ` +
        `vs payload P${stored.servingPlayerIndex}@${stored.servingSide}; ` +
        `derived receiver P${derived.receivingPlayerIndex}@${derived.receivingSide} ` +
        `vs payload P${stored.receivingPlayerIndex}@${stored.receivingSide}`);
    return false;
}
/** Snapshot shape for tests comparing derived vs stored payload fields. */
export function doublesServeToPointSnapshot(ds) {
    return {
        servingSide: ds.servingSide,
        servingPlayerIndex: ds.servingPlayerIndex,
        receivingSide: ds.receivingSide,
        receivingPlayerIndex: ds.receivingPlayerIndex,
        courtPositions: ds.courtPositions,
    };
}
