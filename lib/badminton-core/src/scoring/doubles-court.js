export function leftCourtPlayerIndex(pos) {
    return pos.rightCourtPlayerIndex === 0 ? 1 : 0;
}
export function swapSidePartners(pos) {
    return { rightCourtPlayerIndex: leftCourtPlayerIndex(pos) };
}
/** Even score → right service court; odd → left service court. */
export function serverIndexForScore(sideScore, positions) {
    const serveFromRight = sideScore % 2 === 0;
    return serveFromRight ? positions.rightCourtPlayerIndex : leftCourtPlayerIndex(positions);
}
/** Receiver stands diagonally opposite the server. */
export function receiverIndexForServer(serverIndex, serverPositions, receiverPositions) {
    const serverInRightCourt = serverIndex === serverPositions.rightCourtPlayerIndex;
    return serverInRightCourt
        ? receiverPositions.rightCourtPlayerIndex
        : leftCourtPlayerIndex(receiverPositions);
}
export function buildInitialCourtPositions(servingSide, serverPlayerIndex, receivingSide, receiverPlayerIndex) {
    const servingPositions = {
        rightCourtPlayerIndex: serverPlayerIndex,
    };
    const receivingPositions = {
        rightCourtPlayerIndex: receiverPlayerIndex,
    };
    return {
        left: servingSide === "left" ? servingPositions : receivingPositions,
        right: servingSide === "right" ? servingPositions : receivingPositions,
    };
}
export function sideScore(side, leftScore, rightScore) {
    return side === "left" ? leftScore : rightScore;
}
export function opposingSide(side) {
    return side === "left" ? "right" : "left";
}
export function positionsForSide(court, side) {
    return court[side];
}
export function updateSidePositions(court, side, positions) {
    return { ...court, [side]: positions };
}
/** After a rally — apply BWF partner-swap rules and return new serve/receive state. */
export function advanceDoublesServeAfterPoint(winningSide, servingSide, leftScore, rightScore, courtPositions) {
    let court = { ...courtPositions };
    if (winningSide === servingSide) {
        // Serving side won — same server continues; partners swap service courts (BWF 10.3.3).
        const swapped = swapSidePartners(positionsForSide(court, servingSide));
        court = updateSidePositions(court, servingSide, swapped);
    }
    // Receiving side won — no partner swap. Players stay in place; serve transfers
    // to the rally winner who already stands in the court matching their new score (BWF 10.3.4).
    const newServingSide = winningSide;
    const newReceivingSide = opposingSide(newServingSide);
    const newServingScore = sideScore(newServingSide, leftScore, rightScore);
    const servingPositions = positionsForSide(court, newServingSide);
    const receivingPositions = positionsForSide(court, newReceivingSide);
    const servingPlayerIndex = serverIndexForScore(newServingScore, servingPositions);
    const receivingPlayerIndex = receiverIndexForServer(servingPlayerIndex, servingPositions, receivingPositions);
    return {
        servingSide: newServingSide,
        servingPlayerIndex,
        receivingSide: newReceivingSide,
        receivingPlayerIndex,
        courtPositions: court,
    };
}
/** BWF: next game first server based on last rally of previous game. */
export function nextGameServerAfterGameEnd(gameWinner, lastServingSide, lastServerPlayerIndex, lastRallyWinningSide) {
    if (lastRallyWinningSide === lastServingSide) {
        // Serving side won last rally — partner of last server serves first.
        return lastServerPlayerIndex === 0 ? 1 : 0;
    }
    // Receiving side won last rally — last server serves first in new game.
    return lastServerPlayerIndex;
}
export function buildNextGameCourtPositions(servingSide, serverPlayerIndex, leftPositions, rightPositions) {
    // At 0-0 server must be in right court.
    const servingPositions = { rightCourtPlayerIndex: serverPlayerIndex };
    const receivingSide = opposingSide(servingSide);
    const receivingPositions = positionsForSide({ left: leftPositions, right: rightPositions }, receivingSide);
    const receiverIndex = receiverIndexForServer(serverPlayerIndex, servingPositions, receivingPositions);
    return buildInitialCourtPositions(servingSide, serverPlayerIndex, receivingSide, receiverIndex);
}
