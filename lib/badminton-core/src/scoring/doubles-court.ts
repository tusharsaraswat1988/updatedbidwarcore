import type { BadmintonSide } from "../types";
import type { DoublesCourtPositionsState, SideCourtPositions } from "./types";

export function leftCourtPlayerIndex(pos: SideCourtPositions): 0 | 1 {
  return pos.rightCourtPlayerIndex === 0 ? 1 : 0;
}

export function swapSidePartners(pos: SideCourtPositions): SideCourtPositions {
  return { rightCourtPlayerIndex: leftCourtPlayerIndex(pos) };
}

/** Even score → right service court; odd → left service court. */
export function serverIndexForScore(
  sideScore: number,
  positions: SideCourtPositions,
): 0 | 1 {
  const serveFromRight = sideScore % 2 === 0;
  return serveFromRight ? positions.rightCourtPlayerIndex : leftCourtPlayerIndex(positions);
}

/** Receiver stands diagonally opposite the server. */
export function receiverIndexForServer(
  serverIndex: 0 | 1,
  serverPositions: SideCourtPositions,
  receiverPositions: SideCourtPositions,
): 0 | 1 {
  const serverInRightCourt = serverIndex === serverPositions.rightCourtPlayerIndex;
  return serverInRightCourt
    ? receiverPositions.rightCourtPlayerIndex
    : leftCourtPlayerIndex(receiverPositions);
}

export function buildInitialCourtPositions(
  servingSide: BadmintonSide,
  serverPlayerIndex: 0 | 1,
  receivingSide: BadmintonSide,
  receiverPlayerIndex: 0 | 1,
): DoublesCourtPositionsState {
  const servingPositions: SideCourtPositions = {
    rightCourtPlayerIndex: serverPlayerIndex,
  };
  const receivingPositions: SideCourtPositions = {
    rightCourtPlayerIndex: receiverPlayerIndex,
  };

  return {
    left: servingSide === "left" ? servingPositions : receivingPositions,
    right: servingSide === "right" ? servingPositions : receivingPositions,
  };
}

export function sideScore(
  side: BadmintonSide,
  leftScore: number,
  rightScore: number,
): number {
  return side === "left" ? leftScore : rightScore;
}

export function opposingSide(side: BadmintonSide): BadmintonSide {
  return side === "left" ? "right" : "left";
}

export function positionsForSide(
  court: DoublesCourtPositionsState,
  side: BadmintonSide,
): SideCourtPositions {
  return court[side];
}

export function updateSidePositions(
  court: DoublesCourtPositionsState,
  side: BadmintonSide,
  positions: SideCourtPositions,
): DoublesCourtPositionsState {
  return { ...court, [side]: positions };
}

/** After a rally — apply BWF partner-swap rules and return new serve/receive state. */
export function advanceDoublesServeAfterPoint(
  winningSide: BadmintonSide,
  servingSide: BadmintonSide,
  leftScore: number,
  rightScore: number,
  courtPositions: DoublesCourtPositionsState,
): {
  servingSide: BadmintonSide;
  servingPlayerIndex: 0 | 1;
  receivingSide: BadmintonSide;
  receivingPlayerIndex: 0 | 1;
  courtPositions: DoublesCourtPositionsState;
} {
  let court = { ...courtPositions };

  if (winningSide === servingSide) {
    // Serving side won — swap partners on serving side only.
    const swapped = swapSidePartners(positionsForSide(court, servingSide));
    court = updateSidePositions(court, servingSide, swapped);
  } else {
    // Receiving side won — swap partners on the side that was serving.
    const swapped = swapSidePartners(positionsForSide(court, servingSide));
    court = updateSidePositions(court, servingSide, swapped);
  }

  const newServingSide = winningSide;
  const newReceivingSide = opposingSide(newServingSide);
  const newServingScore = sideScore(newServingSide, leftScore, rightScore);
  const servingPositions = positionsForSide(court, newServingSide);
  const receivingPositions = positionsForSide(court, newReceivingSide);

  const servingPlayerIndex = serverIndexForScore(newServingScore, servingPositions);
  const receivingPlayerIndex = receiverIndexForServer(
    servingPlayerIndex,
    servingPositions,
    receivingPositions,
  );

  return {
    servingSide: newServingSide,
    servingPlayerIndex,
    receivingSide: newReceivingSide,
    receivingPlayerIndex,
    courtPositions: court,
  };
}

/** BWF: next game first server based on last rally of previous game. */
export function nextGameServerAfterGameEnd(
  gameWinner: BadmintonSide,
  lastServingSide: BadmintonSide,
  lastServerPlayerIndex: 0 | 1,
  lastRallyWinningSide: BadmintonSide,
): 0 | 1 {
  if (lastRallyWinningSide === lastServingSide) {
    // Serving side won last rally — partner of last server serves first.
    return lastServerPlayerIndex === 0 ? 1 : 0;
  }
  // Receiving side won last rally — last server serves first in new game.
  return lastServerPlayerIndex;
}

export function buildNextGameCourtPositions(
  servingSide: BadmintonSide,
  serverPlayerIndex: 0 | 1,
  leftPositions: SideCourtPositions,
  rightPositions: SideCourtPositions,
): DoublesCourtPositionsState {
  // At 0-0 server must be in right court.
  const servingPositions: SideCourtPositions = { rightCourtPlayerIndex: serverPlayerIndex };
  const receivingSide = opposingSide(servingSide);
  const receivingPositions = positionsForSide(
    { left: leftPositions, right: rightPositions },
    receivingSide,
  );
  const receiverIndex = receiverIndexForServer(
    serverPlayerIndex,
    servingPositions,
    receivingPositions,
  );

  return buildInitialCourtPositions(
    servingSide,
    serverPlayerIndex,
    receivingSide,
    receiverIndex,
  );
}
