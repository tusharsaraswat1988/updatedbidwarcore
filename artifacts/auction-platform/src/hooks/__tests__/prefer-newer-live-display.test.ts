import { describe, expect, it } from "vitest";
import { preferNewerLiveDisplay } from "@/hooks/use-scoring-match";
import type { ScoringLiveDisplay } from "@/lib/scoring-api";

function display(sequence: number, runs: number, matchId = 7): ScoringLiveDisplay {
  return {
    match: { id: matchId } as ScoringLiveDisplay["match"],
    state: {
      matchId,
      lastSequence: sequence,
      innings: [{ runs }],
    } as ScoringLiveDisplay["state"],
    summary: null,
  };
}

describe("preferNewerLiveDisplay", () => {
  it("keeps the newer score when a late frame arrives", () => {
    const current = display(8, 24);
    const stale = display(7, 20);
    expect(preferNewerLiveDisplay(current, stale)).toBe(current);
  });

  it("accepts the next delivery", () => {
    const current = display(8, 24);
    const next = display(9, 28);
    const kept = preferNewerLiveDisplay(current, next);
    expect(kept?.state?.lastSequence).toBe(9);
    expect(kept?.state?.innings?.[0]?.runs).toBe(28);
  });

  it("accepts a new match even when its sequence is lower", () => {
    const finished = display(40, 160, 7);
    const nextMatch = display(1, 0, 8);
    expect(preferNewerLiveDisplay(finished, nextMatch)?.state?.matchId).toBe(8);
  });

  it("does not wipe a live score with an empty frame", () => {
    const current = display(4, 12);
    const empty: ScoringLiveDisplay = { match: null, state: null, summary: null };
    expect(preferNewerLiveDisplay(current, empty)).toBe(current);
  });
});
