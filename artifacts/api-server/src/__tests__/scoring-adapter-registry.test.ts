import { describe, expect, it } from "vitest";
import { scoringAdapterRegistry } from "@workspace/scoring-core";
import { badmintonScoringAdapter } from "../lib/scoring-adapters/badminton-scoring-adapter";

// Side-effect registration (mirrors production boot)
import "../lib/scoring-adapters/register";

describe("scoring adapter registration", () => {
  it("registers cricket and badminton adapters at boot", () => {
    expect(scoringAdapterRegistry.has("cricket")).toBe(true);
    expect(scoringAdapterRegistry.has("badminton")).toBe(true);
    expect(scoringAdapterRegistry.get("badminton")).toBe(badmintonScoringAdapter);
  });

  it("lists manifests for both sports", () => {
    const manifests = scoringAdapterRegistry.listManifests();
    const slugs = manifests.map((m) => m.sportSlug).sort();
    expect(slugs).toEqual(["badminton", "cricket"]);
  });
});
