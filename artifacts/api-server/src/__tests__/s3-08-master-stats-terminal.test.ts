import { describe, expect, it } from "vitest";
import {
  isBadmintonTerminalMatchStatus,
  mapBadmintonStatusToFixtureStatus,
  mapBadmintonStatusToScoringMatchStatus,
  shouldApplyMasterStatisticsForMatch,
  shouldRunBadmintonMasterStatistics,
} from "../lib/badminton-match-status";

describe("S3-08 badminton terminal status mapping", () => {
  it("recognizes all terminal engine statuses", () => {
    for (const status of [
      "completed",
      "walkover",
      "retired",
      "disqualified",
      "abandoned",
    ]) {
      expect(isBadmintonTerminalMatchStatus(status)).toBe(true);
      expect(shouldRunBadmintonMasterStatistics(status)).toBe(true);
    }
    expect(isBadmintonTerminalMatchStatus("live")).toBe(false);
    expect(shouldRunBadmintonMasterStatistics("live")).toBe(false);
  });

  it("preserves terminal kinds on scoring_matches (does not collapse to completed)", () => {
    expect(mapBadmintonStatusToScoringMatchStatus("walkover")).toBe("walkover");
    expect(mapBadmintonStatusToScoringMatchStatus("retired")).toBe("retired");
    expect(mapBadmintonStatusToScoringMatchStatus("disqualified")).toBe("disqualified");
    expect(mapBadmintonStatusToScoringMatchStatus("abandoned")).toBe("abandoned");
    expect(mapBadmintonStatusToScoringMatchStatus("completed")).toBe("completed");
    expect(mapBadmintonStatusToScoringMatchStatus("live")).toBe("live");
  });

  it("maps fixture status with accurate terminal kinds", () => {
    expect(mapBadmintonStatusToFixtureStatus("walkover")).toBe("walkover");
    expect(mapBadmintonStatusToFixtureStatus("retired")).toBe("retired");
    expect(mapBadmintonStatusToFixtureStatus("disqualified")).toBe("disqualified");
    expect(mapBadmintonStatusToFixtureStatus("abandoned")).toBe("abandoned");
    expect(mapBadmintonStatusToFixtureStatus("completed")).toBe("completed");
    expect(mapBadmintonStatusToFixtureStatus("paused")).toBe("live");
  });

  it("idempotent master-stats gate skips when processed marker is set", () => {
    expect(shouldApplyMasterStatisticsForMatch(null)).toBe(true);
    expect(shouldApplyMasterStatisticsForMatch(undefined)).toBe(true);
    expect(shouldApplyMasterStatisticsForMatch(new Date())).toBe(false);
    expect(shouldApplyMasterStatisticsForMatch("2026-07-29T00:00:00.000Z")).toBe(false);
  });
});
