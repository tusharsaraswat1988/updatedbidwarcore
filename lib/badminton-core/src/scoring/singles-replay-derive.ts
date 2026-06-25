/**
 * Grade A Phase A (singles) — derive scores and serve on replay from rally outcomes.
 * Legacy payloads may still carry winnerScore/loserScore; drift is logged, not fatal.
 */

import type { BadmintonPointWonPayload } from "../events/badminton";
import type { BadmintonMatchState, BadmintonSide } from "../types";

export type DerivedSinglesScores = {
  newLeftScore: number;
  newRightScore: number;
};

let driftWarningHandler: ((message: string) => void) | null = null;

/** Optional hook for production drift logging (default: console.warn). */
export function setSinglesScoreDriftWarningHandler(
  handler: ((message: string) => void) | null,
): void {
  driftWarningHandler = handler;
}

function warnDrift(message: string): void {
  if (driftWarningHandler) {
    driftWarningHandler(message);
    return;
  }
  console.warn(`[badminton-core] singles score drift: ${message}`);
}

/** Derive post-rally scores from pre-rally state + rally winner. */
export function deriveSinglesScoresAfterPointWon(
  state: BadmintonMatchState,
  payload: BadmintonPointWonPayload,
): DerivedSinglesScores {
  return {
    newLeftScore:
      payload.winningSide === "left" ? state.leftScore + 1 : state.leftScore,
    newRightScore:
      payload.winningSide === "right" ? state.rightScore + 1 : state.rightScore,
  };
}

function payloadScores(payload: BadmintonPointWonPayload): DerivedSinglesScores {
  return {
    newLeftScore:
      payload.winningSide === "left" ? payload.winnerScore : payload.loserScore,
    newRightScore:
      payload.winningSide === "right" ? payload.winnerScore : payload.loserScore,
  };
}

/** Compare derived scores to legacy payload fields; warn on mismatch. */
export function validateSinglesScoresAgainstPayload(
  derived: DerivedSinglesScores,
  payload: BadmintonPointWonPayload,
): boolean {
  const stored = payloadScores(payload);
  if (
    derived.newLeftScore === stored.newLeftScore &&
    derived.newRightScore === stored.newRightScore
  ) {
    return true;
  }

  warnDrift(
    `derived ${derived.newLeftScore}-${derived.newRightScore} ` +
      `vs payload ${stored.newLeftScore}-${stored.newRightScore} ` +
      `(winner=${payload.winningSide})`,
  );
  return false;
}

/** Singles: server is always the rally winner under BWF rally-point scoring. */
export function deriveSinglesServingSideAfterPointWon(
  payload: BadmintonPointWonPayload,
): BadmintonSide {
  return payload.winningSide;
}

/** Warn when legacy payload servingSide disagrees with derived winner-serves rule. */
export function validateSinglesServingSideAgainstPayload(
  derivedServingSide: BadmintonSide,
  payload: BadmintonPointWonPayload,
): boolean {
  if (!payload.servingSide || payload.servingSide === derivedServingSide) {
    return true;
  }

  warnDrift(
    `derived servingSide=${derivedServingSide} vs payload servingSide=${payload.servingSide}`,
  );
  return false;
}
