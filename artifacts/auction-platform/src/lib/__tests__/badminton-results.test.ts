import { describe, expect, it } from "vitest";
import { isCompletedMatch, type ResultsMatch } from "../badminton-results";

function match(status: string, stateStatus?: string): ResultsMatch {
  return {
    id: 1,
    status,
    detail: null,
    state: stateStatus
      ? ({ matchStatus: stateStatus, winnerSide: "left" } as ResultsMatch["state"])
      : null,
  };
}

describe("isCompletedMatch", () => {
  it("includes all terminal scoring statuses", () => {
    for (const status of [
      "completed",
      "walkover",
      "retired",
      "disqualified",
      "abandoned",
    ]) {
      expect(isCompletedMatch(match(status))).toBe(true);
    }
  });

  it("excludes live and scheduled matches", () => {
    expect(isCompletedMatch(match("live"))).toBe(false);
    expect(isCompletedMatch(match("scheduled"))).toBe(false);
    expect(isCompletedMatch(match("paused"))).toBe(false);
  });

  it("falls back to state.matchStatus when row status is stale", () => {
    expect(isCompletedMatch(match("live", "walkover"))).toBe(true);
  });
});
