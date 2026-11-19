import { describe, expect, it } from "vitest";
import { CricketEventType, type CricketScoreboardState } from "@workspace/scoring-core";
import {
  setupEventAlreadyOnScoreboard,
  shouldRetrySetupEventAfterConflict,
} from "../cricket-setup-retry";

function state(partial: Partial<CricketScoreboardState>): CricketScoreboardState {
  return partial as CricketScoreboardState;
}

describe("shouldRetrySetupEventAfterConflict", () => {
  it("retries a setup event only after a sequence conflict", () => {
    expect(
      shouldRetrySetupEventAfterConflict(409, "SEQUENCE_CONFLICT", CricketEventType.BOWLER_CHANGED),
    ).toBe(true);
  });

  it("does not retry lease conflicts, match start rejection, or balls", () => {
    expect(
      shouldRetrySetupEventAfterConflict(409, "SCORER_LEASE_REVOKED", CricketEventType.BOWLER_CHANGED),
    ).toBe(false);
    expect(
      shouldRetrySetupEventAfterConflict(409, "MATCH_ALREADY_STARTED", CricketEventType.MATCH_STARTED),
    ).toBe(false);
    expect(
      shouldRetrySetupEventAfterConflict(409, "SEQUENCE_CONFLICT", CricketEventType.BALL_RECORDED),
    ).toBe(false);
  });
});

describe("setupEventAlreadyOnScoreboard", () => {
  it("treats an already started match, bowler, batter, and lineup as applied", () => {
    expect(
      setupEventAlreadyOnScoreboard(CricketEventType.MATCH_STARTED, {}, state({ matchStatus: "live" })),
    ).toBe(true);
    expect(
      setupEventAlreadyOnScoreboard(
        CricketEventType.BOWLER_CHANGED,
        { bowlerId: 9 },
        state({ bowlerId: 9 }),
      ),
    ).toBe(true);
    expect(
      setupEventAlreadyOnScoreboard(
        CricketEventType.BATTER_SELECTED,
        { playerId: 4 },
        state({ strikerId: 4, nonStrikerId: 5 }),
      ),
    ).toBe(true);
    expect(
      setupEventAlreadyOnScoreboard(
        CricketEventType.LINEUP_SET,
        { teamId: 2, playerIds: [4, 5] },
        state({ lineups: { 2: [4, 5] } }),
      ),
    ).toBe(true);
  });

  it("does not treat a different bowler or a scheduled match as applied", () => {
    expect(
      setupEventAlreadyOnScoreboard(
        CricketEventType.BOWLER_CHANGED,
        { bowlerId: 9 },
        state({ bowlerId: 8 }),
      ),
    ).toBe(false);
    expect(
      setupEventAlreadyOnScoreboard(
        CricketEventType.MATCH_STARTED,
        {},
        state({ matchStatus: "scheduled" }),
      ),
    ).toBe(false);
  });
});
