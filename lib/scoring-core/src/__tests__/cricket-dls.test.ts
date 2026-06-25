import { describe, expect, it } from "vitest";
import {
  calculateDlsChaseTarget,
  calculateDlsMidChasePar,
  oversToLegalBalls,
  resourceRemainingPercent,
} from "../cricket/dls";

describe("DLS calculations", () => {
  it("converts overs to legal balls", () => {
    expect(oversToLegalBalls("14.3")).toBe(87);
    expect(oversToLegalBalls("20.0")).toBe(120);
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
    expect(shortened.target).toBeGreaterThan(0);
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
});
