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

/**
 * Court quadrant labels for UI.
 * Top row = left side (facing toward bottom of screen).
 * Bottom row = right side (facing toward top of screen).
 *
 * `rightCourtPlayerIndex` is from each side's perspective facing the net.
 * Because the bottom side faces the opposite way, their left/right maps are
 * flipped onto the screen so serve/receive appear diagonally (BWF), not stacked
 * in the same column.
 */
export function getCourtQuadrantPlayers(state: BadmintonMatchState): {
  topLeft: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
  topRight: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
  bottomLeft: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
  bottomRight: { side: BadmintonSide; playerIndex: 0 | 1; label: string; isServer: boolean; isReceiver: boolean };
} | null {
  const ds = state.doublesServe;
  if (!ds) return null;

  function quadrant(
    serveState: DoublesServeState,
    side: BadmintonSide,
    /** Service court from that side's perspective when facing the net. */
    sideCourt: "left" | "right",
  ) {
    const positions = serveState.courtPositions[side];
    const playerIndex =
      sideCourt === "right"
        ? positions.rightCourtPlayerIndex
        : positions.rightCourtPlayerIndex === 0
          ? 1
          : 0;
    return {
      side,
      playerIndex: playerIndex as 0 | 1,
      label: getPlayerShortLabel(sideInfoFor(state, side), playerIndex as 0 | 1),
      isServer: serveState.servingSide === side && serveState.servingPlayerIndex === playerIndex,
      isReceiver: serveState.receivingSide === side && serveState.receivingPlayerIndex === playerIndex,
    };
  }

  return {
    // Top side faces down: their left = screen left, their right = screen right.
    topLeft: quadrant(ds, "left", "left"),
    topRight: quadrant(ds, "left", "right"),
    // Bottom side faces up: their right = screen left, their left = screen right.
    bottomLeft: quadrant(ds, "right", "right"),
    bottomRight: quadrant(ds, "right", "left"),
  };
}

export function hasDoublesServeState(state: BadmintonMatchState): state is BadmintonMatchState & {
  doublesServe: DoublesServeState;
} {
  return state.doublesServe != null;
}
