import type { BadmintonMatchState, BadmintonSide, BadmintonSideInfo } from "../types";
import { getSidePlayerSlots } from "../side-utils";
import type { DoublesServeState } from "./types";

export function getPlayerLabel(
  sideInfo: BadmintonSideInfo,
  playerIndex: 0 | 1,
): string {
  const slots = getSidePlayerSlots(sideInfo);
  return slots[playerIndex]?.label ?? slots[playerIndex]?.shortLabel ?? `Player ${playerIndex + 1}`;
}

export function getPlayerShortLabel(
  sideInfo: BadmintonSideInfo,
  playerIndex: 0 | 1,
): string {
  const slots = getSidePlayerSlots(sideInfo);
  return slots[playerIndex]?.shortLabel ?? slots[playerIndex]?.label ?? `P${playerIndex + 1}`;
}

export function sideInfoFor(
  state: BadmintonMatchState,
  side: BadmintonSide,
): BadmintonSideInfo {
  return side === "left" ? state.leftSide : state.rightSide;
}

export function currentServerLabel(state: BadmintonMatchState): string | null {
  const ds = state.doublesServe;
  if (!ds) return null;
  return getPlayerLabel(sideInfoFor(state, ds.servingSide), ds.servingPlayerIndex);
}

export function currentReceiverLabel(state: BadmintonMatchState): string | null {
  const ds = state.doublesServe;
  if (!ds) return null;
  return getPlayerLabel(sideInfoFor(state, ds.receivingSide), ds.receivingPlayerIndex);
}

/** Court quadrant labels for UI — top row = left side, bottom row = right side. */
export function getCourtQuadrantPlayers(state: BadmintonMatchState): {
  topLeft: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
  topRight: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
  bottomLeft: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
  bottomRight: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
} | null {
  const serveState = state.doublesServe;
  if (!serveState) return null;

  function quadrant(
    side: BadmintonSide,
    court: "left" | "right",
  ) {
    const positions = serveState.courtPositions[side];
    const playerIndex =
      court === "right" ? positions.rightCourtPlayerIndex : (positions.rightCourtPlayerIndex === 0 ? 1 : 0);
    return {
      side,
      playerIndex: playerIndex as 0 | 1,
      label: getPlayerShortLabel(sideInfoFor(state, side), playerIndex as 0 | 1),
      isServer: serveState.servingSide === side && serveState.servingPlayerIndex === playerIndex,
      isReceiver: serveState.receivingSide === side && serveState.receivingPlayerIndex === playerIndex,
    };
  }

  return {
    topLeft: quadrant("left", "left"),
    topRight: quadrant("left", "right"),
    bottomLeft: quadrant("right", "left"),
    bottomRight: quadrant("right", "right"),
  };
}

export function hasDoublesServeState(state: BadmintonMatchState): state is BadmintonMatchState & {
  doublesServe: DoublesServeState;
} {
  return state.doublesServe != null;
}
