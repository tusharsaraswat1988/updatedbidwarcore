/**
 * Venue LED auto-SFX cue detection from match state edges.
 * Pure — no audio playback. Display hook owns dedupe across hydrations.
 */

import type { BadmintonMatchState } from "../types";
import { isInDeuce } from "../reducer/state";
import { detectGamePointSide, detectMatchPointSide } from "./scorer-assistance";

export type BadmintonVenueSfxKind = "game_point" | "match_point" | "deuce";

export type VenueAudioUrgencySnapshot = {
  matchPoint: boolean;
  gamePoint: boolean;
  deuce: boolean;
};

export function snapshotVenueAudioUrgency(
  state: BadmintonMatchState,
): VenueAudioUrgencySnapshot {
  const matchPoint = detectMatchPointSide(state) != null;
  const gamePoint = !matchPoint && detectGamePointSide(state) != null;
  const deuce = isInDeuce(
    state.leftScore,
    state.rightScore,
    state.format.deuceAt,
  );
  return { matchPoint, gamePoint, deuce };
}

/**
 * Returns the SFX to play when urgency edges rise.
 * Pass `prev === null` on first hydrate to suppress replay.
 * Match Point wins over Game Point when both would apply.
 */
export function detectVenueAudioCue(
  prev: VenueAudioUrgencySnapshot | null,
  state: BadmintonMatchState,
): BadmintonVenueSfxKind | null {
  const next = snapshotVenueAudioUrgency(state);
  if (!prev) return null;
  if (next.matchPoint && !prev.matchPoint) return "match_point";
  if (next.gamePoint && !prev.gamePoint) return "game_point";
  if (next.deuce && !prev.deuce) return "deuce";
  return null;
}
