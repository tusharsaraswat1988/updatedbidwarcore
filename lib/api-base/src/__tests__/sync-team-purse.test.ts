import { describe, expect, it } from "vitest";
import {
  resolveTeamIdsForBasePurseUpdate,
  teamIdsEligibleForBasePurseDriftRepair,
  teamIdsEligibleForBasePurseSync,
} from "../sync-team-purse";

describe("teamIdsEligibleForBasePurseSync", () => {
  it("returns teams still on the previous default, including after spend", () => {
    const ids = teamIdsEligibleForBasePurseSync(
      [
        { id: 1, purse: 1_000_000, purseUsed: 0 },
        { id: 2, purse: 1_500_000, purseUsed: 0 },
        { id: 3, purse: 1_000_000, purseUsed: 50_000 },
      ],
      1_000_000,
      1_500_000,
    );
    expect(ids).toEqual([1, 3]);
  });

  it("skips teams that cannot afford the new budget floor", () => {
    const ids = teamIdsEligibleForBasePurseSync(
      [{ id: 1, purse: 1_000_000, purseUsed: 1_200_000 }],
      1_000_000,
      1_100_000,
    );
    expect(ids).toEqual([]);
  });

  it("returns empty when no team matches the previous default", () => {
    const ids = teamIdsEligibleForBasePurseSync(
      [{ id: 1, purse: 1_500_000, purseUsed: 0 }],
      1_000_000,
      2_000_000,
    );
    expect(ids).toEqual([]);
  });
});

describe("teamIdsEligibleForBasePurseDriftRepair", () => {
  it("repairs uniform stale purses below the tournament default", () => {
    const ids = teamIdsEligibleForBasePurseDriftRepair(
      [
        { id: 1, purse: 1_000_000, purseUsed: 100_000 },
        { id: 2, purse: 1_000_000, purseUsed: 250_000 },
      ],
      1_500_000,
    );
    expect(ids).toEqual([1, 2]);
  });

  it("skips mixed purse values (custom team budgets)", () => {
    const ids = teamIdsEligibleForBasePurseDriftRepair(
      [
        { id: 1, purse: 1_000_000, purseUsed: 0 },
        { id: 2, purse: 1_200_000, purseUsed: 0 },
      ],
      1_500_000,
    );
    expect(ids).toEqual([]);
  });
});

describe("resolveTeamIdsForBasePurseUpdate", () => {
  it("combines change sync and drift repair", () => {
    const ids = resolveTeamIdsForBasePurseUpdate(
      [
        { id: 1, purse: 1_000_000, purseUsed: 100_000 },
        { id: 2, purse: 1_000_000, purseUsed: 50_000 },
      ],
      1_500_000,
      1_000_000,
    );
    expect(ids.sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("runs drift repair when basePurse is unchanged but teams are stale", () => {
    const ids = resolveTeamIdsForBasePurseUpdate(
      [{ id: 4, purse: 1_000_000, purseUsed: 100_000 }],
      1_500_000,
      null,
    );
    expect(ids).toEqual([4]);
  });
});
