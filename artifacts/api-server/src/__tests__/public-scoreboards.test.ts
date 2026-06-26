import { describe, expect, it } from "vitest";
import {
  isTerminalScoringMatchStatus,
  TERMINAL_SCORING_MATCH_STATUSES,
} from "../lib/scoring-match-terminal";

describe("public scoreboards terminal match status", () => {
  it("includes completed and abandoned for public results", () => {
    expect(TERMINAL_SCORING_MATCH_STATUSES).toEqual(["completed", "abandoned"]);
    expect(isTerminalScoringMatchStatus("completed")).toBe(true);
    expect(isTerminalScoringMatchStatus("abandoned")).toBe(true);
    expect(isTerminalScoringMatchStatus("live")).toBe(false);
    expect(isTerminalScoringMatchStatus("scheduled")).toBe(false);
  });
});
