import { describe, expect, it } from "vitest";
import { teamIdsEligibleForBasePurseSync } from "../sync-team-purse";

describe("teamIdsEligibleForBasePurseSync", () => {
  it("returns teams still on the previous default with no spend", () => {
    const ids = teamIdsEligibleForBasePurseSync(
      [
        { id: 1, purse: 1_000_000, purseUsed: 0 },
        { id: 2, purse: 1_500_000, purseUsed: 0 },
        { id: 3, purse: 1_000_000, purseUsed: 50_000 },
      ],
      1_000_000,
    );
    expect(ids).toEqual([1]);
  });

  it("returns empty when no team matches the previous default", () => {
    const ids = teamIdsEligibleForBasePurseSync(
      [{ id: 1, purse: 1_500_000, purseUsed: 0 }],
      1_000_000,
    );
    expect(ids).toEqual([]);
  });
});
