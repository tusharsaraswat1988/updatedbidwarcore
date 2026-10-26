/**
 * Grade A Phase A (singles) — derive scores and serve on replay from rally outcomes.
 * Legacy payloads may still carry winnerScore/loserScore; drift is logged, not fatal.
 */
let driftWarningHandler = null;
/** Optional hook for production drift logging (default: console.warn). */
export function setSinglesScoreDriftWarningHandler(handler) {
    driftWarningHandler = handler;
}
function warnDrift(message) {
    if (driftWarningHandler) {
        driftWarningHandler(message);
        return;
    }
    console.warn(`[badminton-core] singles score drift: ${message}`);
}
/** Derive post-rally scores from pre-rally state + rally winner. */
export function deriveSinglesScoresAfterPointWon(state, payload) {
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
export function validateSinglesScoresAgainstPayload(derived, payload) {
    const stored = payloadScores(payload);
    if (derived.newLeftScore === stored.newLeftScore &&
        derived.newRightScore === stored.newRightScore) {
        return true;
    }
    warnDrift(`derived ${derived.newLeftScore}-${derived.newRightScore} ` +
        `vs payload ${stored.newLeftScore}-${stored.newRightScore} ` +
        `(winner=${payload.winningSide})`);
    return false;
}
/** Singles: server is always the rally winner under BWF rally-point scoring. */
export function deriveSinglesServingSideAfterPointWon(payload) {
    return payload.winningSide;
}
/** Warn when legacy payload servingSide disagrees with derived winner-serves rule. */
export function validateSinglesServingSideAgainstPayload(derivedServingSide, payload) {
    if (!payload.servingSide || payload.servingSide === derivedServingSide) {
        return true;
    }
    warnDrift(`derived servingSide=${derivedServingSide} vs payload servingSide=${payload.servingSide}`);
    return false;
}
