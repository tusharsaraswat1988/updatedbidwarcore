import { describe, expect, it } from "vitest";
import {
  buildTeamReportAuctionRules,
  computeTeamReportPlanningRows,
  describeBidIncrementRules,
} from "../team-report-rules";

describe("describeBidIncrementRules", () => {
  it("formats a single flat increment", () => {
    const lines = describeBidIncrementRules({
      bidTiers: JSON.stringify([{ increment: 100000 }]),
    });
    expect(lines).toEqual(["Each bid must increase by ₹1.00L or more."]);
  });

  it("formats tiered increments", () => {
    const lines = describeBidIncrementRules({
      bidTiers: JSON.stringify([
        { upTo: 100000, increment: 25000 },
        { upTo: 200000, increment: 50000 },
        { increment: 100000 },
      ]),
    });
    expect(lines[0]).toContain("Up to ₹1.00L");
    expect(lines.at(-1)).toContain("Above ₹2.00L");
  });
});

describe("buildTeamReportAuctionRules", () => {
  it("omits zero squad limits and includes player-chosen base note", () => {
    const rules = buildTeamReportAuctionRules({
      minBid: 100000,
      auctionUnit: "rupee",
      bidValueMode: "player",
      minimumSquadSize: 0,
      maximumSquadSize: 12,
      categories: [{ name: "Gold", minBid: 150000 }],
      tournament: { bidTiers: JSON.stringify([{ increment: 50000 }]) },
    });

    expect(rules.minimumSquadSize).toBeNull();
    expect(rules.maximumSquadSize).toBe(12);
    expect(rules.playersChooseBaseValue).toBe(true);
    expect(rules.categoryMinBids).toEqual([{ name: "Gold", minBid: 150000 }]);
  });
});

describe("computeTeamReportPlanningRows", () => {
  it("uses minimum squad size when maximum is unset", () => {
    expect(computeTeamReportPlanningRows(1, 10, 0)).toEqual({
      planningRows: 9,
      slotsRemaining: 9,
    });
  });
});
