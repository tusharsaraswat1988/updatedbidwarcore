import { describe, expect, it } from "vitest";
import type { BadmintonMatchState } from "./types";
import {
  applyMatchStateIfNewer,
  getEventSequence,
  mergeMatchStateCache,
} from "./match-state-guard";

function stateWithSeq(seq: number): BadmintonMatchState {
  return { lastSequence: seq } as BadmintonMatchState;
}

describe("match-state-guard", () => {
  it("accepts first snapshot when cache is empty", () => {
    const incoming = stateWithSeq(1);
    const result = applyMatchStateIfNewer(null, incoming);
    expect(result.applied).toBe(true);
    expect(result.state).toBe(incoming);
  });

  it("accepts strictly newer snapshot", () => {
    const current = stateWithSeq(5);
    const incoming = stateWithSeq(6);
    const result = applyMatchStateIfNewer(current, incoming);
    expect(result.applied).toBe(true);
    expect(getEventSequence(result.state)).toBe(6);
  });

  it("ignores duplicate snapshot (same sequence)", () => {
    const current = stateWithSeq(5);
    const incoming = stateWithSeq(5);
    const result = applyMatchStateIfNewer(current, incoming);
    expect(result.applied).toBe(false);
    if (!result.applied) expect(result.reason).toBe("duplicate");
    expect(result.state).toBe(current);
  });

  it("ignores stale / out-of-order snapshot", () => {
    const current = stateWithSeq(10);
    const incoming = stateWithSeq(7);
    const result = applyMatchStateIfNewer(current, incoming);
    expect(result.applied).toBe(false);
    if (!result.applied) expect(result.reason).toBe("stale");
    expect(getEventSequence(result.state)).toBe(10);
  });

  it("mergeMatchStateCache preserves detail and rejects stale SSE", () => {
    const prev = {
      state: stateWithSeq(20),
      detail: { courtNumber: "1" },
    };
    const merged = mergeMatchStateCache(prev, stateWithSeq(18));
    expect(merged.state).toBe(prev.state);
    expect(merged.detail).toEqual({ courtNumber: "1" });
  });

  it("mergeMatchStateCache applies newer snapshot", () => {
    const prev = {
      state: stateWithSeq(20),
      detail: { courtNumber: "1" },
    };
    const incoming = stateWithSeq(21);
    const merged = mergeMatchStateCache(prev, incoming);
    expect(merged.state).toBe(incoming);
    expect(merged.detail).toEqual({ courtNumber: "1" });
  });
});
