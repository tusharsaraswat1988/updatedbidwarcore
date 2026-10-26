import { describe, expect, it } from "vitest";
import {
  calculateDlsChaseTarget,
  calculateDlsMidChasePar,
  oversToLegalBalls,
  resourceRemainingPercent,
} from "../cricket/dls";
import { reduceCricket } from "../cricket/reducer";
import { createInitialCricketState } from "../cricket/state";
import { CricketEventType } from "../events/cricket";

describe("DLS calculations", () => {
  it("converts overs to legal balls", () => {
    expect(oversToLegalBalls("14.3")).toBe(87);
    expect(oversToLegalBalls("20.0")).toBe(120);
    expect(oversToLegalBalls(15)).toBe(90);
  });

  it("reduces resource with wickets lost", () => {
    const full = resourceRemainingPercent(20, "0.0", 0);
    const threeDown = resourceRemainingPercent(20, "0.0", 3);
    expect(threeDown).toBeLessThan(full);
  });

  it("lowers chase target when overs are reduced", () => {
    const full = calculateDlsChaseTarget({
      scheduledOvers: 20,
      firstInningsRuns: 180,
      firstInningsOvers: "20.0",
      firstInningsWickets: 6,
      revisedOvers: 20,
    });
    const shortened = calculateDlsChaseTarget({
      scheduledOvers: 20,
      firstInningsRuns: 180,
      firstInningsOvers: "20.0",
      firstInningsWickets: 6,
      revisedOvers: 15,
    });
    expect(shortened.target).toBeLessThan(full.target);
    expect(shortened.target).toBe(136);
  });

  it("computes mid-chase par when overs reduced during chase", () => {
    const result = calculateDlsMidChasePar({
      scheduledOvers: 20,
      firstInningsRuns: 160,
      firstInningsOvers: "20.0",
      firstInningsWickets: 5,
      secondInningsRuns: 80,
      secondInningsOvers: "10.0",
      secondInningsWickets: 2,
      revisedOvers: 12,
    });
    expect(result.target).toBeGreaterThan(80);
    expect(result.parScore).toBeGreaterThan(0);
  });

  it("applies DLS successfully even before 2nd innings is created in state", () => {
    const state = createInitialCricketState({
      matchId: 1,
      tournamentId: 1,
      homeTeamId: 10,
      awayTeamId: 20,
      oversLimit: 20,
    });

    const started = reduceCricket(state, {
      sequence: 1,
      matchId: 1,
      tournamentId: 1,
      sportSlug: "cricket",
      actorType: "scorer_pin",
      eventType: CricketEventType.MATCH_STARTED,
      eventVersion: 1,
      payload: {
        tossWinnerTeamId: 10,
        electedTo: "bat",
        oversLimit: 20,
      },
    });

    // Innings 1 is in progress; DLS applied with revised overs 15 & target 130 for innings 2
    const dlsApplied = reduceCricket(started, {
      sequence: 2,
      matchId: 1,
      tournamentId: 1,
      sportSlug: "cricket",
      actorType: "scorer_pin",
      eventType: CricketEventType.DLS_APPLIED,
      eventVersion: 1,
      payload: {
        innings: 2,
        revisedOvers: 15,
        parScore: 129.5,
        target: 130,
        reason: "Rain — DLS",
      },
    });

    expect(dlsApplied.target).toBe(130);
    expect(dlsApplied.revisedOversLimit).toBe(15);
    expect(dlsApplied.oversLimit).toBe(15);
  });
});
