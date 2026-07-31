import { describe, expect, it } from "vitest";
import type { BadmintonMatchState } from "../types";
import { STANDARD_FORMAT } from "../types";
import {
  detectVenueAudioCue,
  snapshotVenueAudioUrgency,
} from "./venue-audio-cues";

function liveState(
  overrides: Partial<BadmintonMatchState> & {
    leftScore: number;
    rightScore: number;
  },
): BadmintonMatchState {
  return {
    matchId: 1,
    tournamentId: 1,
    matchKind: "singles",
    matchStatus: "live",
    format: STANDARD_FORMAT,
    leftScore: overrides.leftScore,
    rightScore: overrides.rightScore,
    gamesLeft: overrides.gamesLeft ?? 0,
    gamesRight: overrides.gamesRight ?? 0,
    currentGame: overrides.currentGame ?? 1,
    servingSide: "left",
    inInterval: false,
    activeTimeout: null,
    isPaused: false,
    pauseReason: null,
    pauseDetail: null,
    winnerSide: null,
    ...overrides,
  } as BadmintonMatchState;
}

describe("venue audio cues", () => {
  it("suppresses cues on first hydrate (prev null)", () => {
    const state = liveState({ leftScore: 20, rightScore: 18 });
    expect(detectVenueAudioCue(null, state)).toBeNull();
  });

  it("fires game_point when a side first reaches game point", () => {
    const prev = snapshotVenueAudioUrgency(liveState({ leftScore: 19, rightScore: 18 }));
    const next = liveState({ leftScore: 20, rightScore: 18 });
    expect(detectVenueAudioCue(prev, next)).toBe("game_point");
  });

  it("prefers match_point over game_point", () => {
    const prev = snapshotVenueAudioUrgency(
      liveState({ leftScore: 19, rightScore: 15, gamesLeft: 1, gamesRight: 0 }),
    );
    const next = liveState({
      leftScore: 20,
      rightScore: 15,
      gamesLeft: 1,
      gamesRight: 0,
    });
    expect(detectVenueAudioCue(prev, next)).toBe("match_point");
  });

  it("fires deuce once when both sides reach deuceAt", () => {
    const prev = snapshotVenueAudioUrgency(liveState({ leftScore: 20, rightScore: 19 }));
    const next = liveState({ leftScore: 20, rightScore: 20 });
    expect(detectVenueAudioCue(prev, next)).toBe("deuce");
    expect(detectVenueAudioCue(snapshotVenueAudioUrgency(next), next)).toBeNull();
  });

  it("does not re-fire game_point while already at game point", () => {
    const state = liveState({ leftScore: 20, rightScore: 18 });
    const prev = snapshotVenueAudioUrgency(state);
    expect(detectVenueAudioCue(prev, state)).toBeNull();
  });
});
