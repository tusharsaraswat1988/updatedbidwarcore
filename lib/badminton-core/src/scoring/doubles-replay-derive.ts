/**
 * Grade A Phase A — derive doubles serve/court state on replay from rally outcomes.
 * Legacy payloads may still carry doublesServe snapshots; drift is logged, not fatal.
 */

import type { BadmintonPointWonPayload } from "../events/badminton";
import type { BadmintonMatchState } from "../types";
import { advanceDoublesServeAfterPoint } from "./doubles-court";
import type { DoublesServeState } from "./types";

export type PointWonDoublesServeSnapshot = NonNullable<BadmintonPointWonPayload["doublesServe"]>;

let driftWarningHandler: ((message: string) => void) | null = null;

/** Optional hook for production drift logging (default: console.warn). */
export function setDoublesServeDriftWarningHandler(
  handler: ((message: string) => void) | null,
): void {
  driftWarningHandler = handler;
}

function warnDrift(message: string): void {
  if (driftWarningHandler) {
    driftWarningHandler(message);
    return;
  }
  console.warn(`[badminton-core] doublesServe drift: ${message}`);
}

/** Derive post-rally doubles serve state from pre-rally state + rally winner. */
export function deriveDoublesServeAfterPointWon(
  state: BadmintonMatchState,
  payload: BadmintonPointWonPayload,
): DoublesServeState | null {
  const ds = state.doublesServe;
  if (!ds) return null;

  const newLeftScore =
    payload.winningSide === "left" ? state.leftScore + 1 : state.leftScore;
  const newRightScore =
    payload.winningSide === "right" ? state.rightScore + 1 : state.rightScore;

  const next = advanceDoublesServeAfterPoint(
    payload.winningSide,
    ds.servingSide,
    newLeftScore,
    newRightScore,
    ds.courtPositions,
  );

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

function snapshotFieldsEqual(
  derived: DoublesServeState,
  stored: PointWonDoublesServeSnapshot,
): boolean {
  return (
    derived.servingSide === stored.servingSide &&
    derived.servingPlayerIndex === stored.servingPlayerIndex &&
    derived.receivingSide === stored.receivingSide &&
    derived.receivingPlayerIndex === stored.receivingPlayerIndex &&
    derived.courtPositions.left.rightCourtPlayerIndex ===
      stored.courtPositions.left.rightCourtPlayerIndex &&
    derived.courtPositions.right.rightCourtPlayerIndex ===
      stored.courtPositions.right.rightCourtPlayerIndex
  );
}

/** Compare derived serve state to a legacy payload snapshot; warn on mismatch. */
export function validateDoublesServeAgainstPayload(
  derived: DoublesServeState,
  stored: PointWonDoublesServeSnapshot | undefined,
): boolean {
  if (!stored) return true;
  if (snapshotFieldsEqual(derived, stored)) return true;

  warnDrift(
    `derived server P${derived.servingPlayerIndex}@${derived.servingSide} ` +
      `vs payload P${stored.servingPlayerIndex}@${stored.servingSide}; ` +
      `derived receiver P${derived.receivingPlayerIndex}@${derived.receivingSide} ` +
      `vs payload P${stored.receivingPlayerIndex}@${stored.receivingSide}`,
  );
  return false;
}

/** Snapshot shape for tests comparing derived vs stored payload fields. */
export function doublesServeToPointSnapshot(
  ds: DoublesServeState,
): PointWonDoublesServeSnapshot {
  return {
    servingSide: ds.servingSide,
    servingPlayerIndex: ds.servingPlayerIndex,
    receivingSide: ds.receivingSide,
    receivingPlayerIndex: ds.receivingPlayerIndex,
    courtPositions: ds.courtPositions,
  };
}
