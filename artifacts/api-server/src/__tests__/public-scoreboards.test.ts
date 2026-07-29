import { describe, expect, it } from "vitest";
import {
  isTerminalScoringMatchStatus,
  TERMINAL_SCORING_MATCH_STATUSES,
} from "../lib/scoring-match-terminal";

describe("public scoreboards terminal match status", () => {
  it("includes badminton terminal outcomes alongside completed/abandoned", () => {
    expect(TERMINAL_SCORING_MATCH_STATUSES).toEqual([
      "completed",
      "abandoned",
      "walkover",
      "retired",
      "disqualified",
    ]);
    expect(isTerminalScoringMatchStatus("completed")).toBe(true);
    expect(isTerminalScoringMatchStatus("abandoned")).toBe(true);
    expect(isTerminalScoringMatchStatus("walkover")).toBe(true);
    expect(isTerminalScoringMatchStatus("retired")).toBe(true);
    expect(isTerminalScoringMatchStatus("disqualified")).toBe(true);
    expect(isTerminalScoringMatchStatus("live")).toBe(false);
    expect(isTerminalScoringMatchStatus("scheduled")).toBe(false);
  });
});
