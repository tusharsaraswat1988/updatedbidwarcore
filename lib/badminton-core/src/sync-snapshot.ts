/**
 * Canonical sync snapshot — fields every badminton display surface must agree on.
 * Used by realtime sync audits and cross-screen consistency tests.
 */

import type { BadmintonMatchState, BadmintonSide } from "./types";
import {
  currentReceiverLabel,
  currentServerLabel,
  getCourtQuadrantPlayers,
  getPlayerShortLabel,
  sideInfoFor,
} from "./scoring/display-utils";

export type CourtQuadrantSnapshot = {
  side: BadmintonSide;
  playerIndex: 0 | 1;
  label: string;
  isServer: boolean;
  isReceiver: boolean;
};

export type BadmintonSyncSnapshot = {
  sequence: number;
  leftScore: number;
  rightScore: number;
  gamesLeft: number;
  gamesRight: number;
  currentGame: number;
  servingSide: BadmintonSide;
  server: string | null;
  receiver: string | null;
  courtPositions: CourtQuadrantSnapshot[] | null;
  matchStatus: string;
  totalRallies: number;
  isPaused: boolean;
  pauseReason?: string;
  pauseDetail?: string;
};

function singlesServerLabel(state: BadmintonMatchState): string {
  return sideInfoFor(state, state.servingSide).shortLabel;
}

function singlesReceiverLabel(state: BadmintonMatchState): string {
  const receivingSide: BadmintonSide = state.servingSide === "left" ? "right" : "left";
  return sideInfoFor(state, receivingSide).shortLabel;
}

/** Extract the cross-screen fields operator, OBS, scoreboard, and broadcast display must match. */
export function extractSyncSnapshot(state: BadmintonMatchState): BadmintonSyncSnapshot {
  const court = getCourtQuadrantPlayers(state);
  const courtPositions = court
    ? [
        court.topLeft,
        court.topRight,
        court.bottomLeft,
        court.bottomRight,
      ]
    : null;

  const server =
    state.doublesServe != null ? currentServerLabel(state) : singlesServerLabel(state);
  const receiver =
    state.doublesServe != null ? currentReceiverLabel(state) : singlesReceiverLabel(state);

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

export function syncSnapshotsEqual(
  a: BadmintonSyncSnapshot,
  b: BadmintonSyncSnapshot,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffSyncSnapshots(
  a: BadmintonSyncSnapshot,
  b: BadmintonSyncSnapshot,
): string[] {
  const mismatches: string[] = [];
  const keys = Object.keys(a) as Array<keyof BadmintonSyncSnapshot>;
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      mismatches.push(`${String(key)}: ${JSON.stringify(a[key])} vs ${JSON.stringify(b[key])}`);
    }
  }
  return mismatches;
}
