import { describe, expect, it } from "vitest";
import { resolveSquadMetrics } from "../squad-metrics";

describe("resolveSquadMetrics", () => {
  it("uses minimum squad size when maximum is unset", () => {
    const m = resolveSquadMetrics(2, 8, 0);
    expect(m.squadCap).toBe(8);
    expect(m.slotsRemaining).toBe(6);
    expect(m.isSquadFull).toBe(false);
  });

  it("uses maximum squad size when configured", () => {
    const m = resolveSquadMetrics(2, 8, 15);
    expect(m.squadCap).toBe(15);
    expect(m.slotsRemaining).toBe(13);
    expect(m.isSquadFull).toBe(false);
  });

  it("marks squad full only at maximum limit", () => {
    const m = resolveSquadMetrics(15, 8, 15);
    expect(m.isSquadFull).toBe(true);
    expect(m.slotsRemaining).toBe(0);
  });

  it("does not mark full when only minimum is met", () => {
    const m = resolveSquadMetrics(8, 8, 0);
    expect(m.isSquadFull).toBe(false);
    expect(m.slotsRemaining).toBe(0);
    expect(m.squadCap).toBe(8);
  });
});
