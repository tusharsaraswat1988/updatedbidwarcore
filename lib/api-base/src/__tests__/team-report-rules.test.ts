import { describe, expect, it } from "vitest";
import {
  buildTeamReportAuctionRules,
  computeTeamReportPlanningRows,
  describeBidIncrementRules,
} from "../team-report-rules";

describe("describeBidIncrementRules", () => {
  it("formats a single flat increment (defaults to points) without double period", () => {
    const lines = describeBidIncrementRules({
      bidTiers: JSON.stringify([{ increment: 100000 }]),
    });
    expect(lines).toEqual(["Each raise must be exactly 1.00 L Pt."]);

    const rupeeLines = describeBidIncrementRules({
      bidTiers: JSON.stringify([{ increment: 100000 }]),
    }, "rupee");
    expect(rupeeLines).toEqual(["Each raise must be exactly ₹1.00L."]);
  });

  it("formats tiered increments", () => {
    const lines = describeBidIncrementRules({
      bidTiers: JSON.stringify([
        { upTo: 100000, increment: 25000 },
        { upTo: 200000, increment: 50000 },
        { increment: 100000 },
      ]),
    });
    expect(lines[0]).toContain("Up to 1.00 L Pt.");
    expect(lines.at(-1)).toContain("Above 2.00 L Pt.");

    const rupeeLines = describeBidIncrementRules({
      bidTiers: JSON.stringify([
        { upTo: 100000, increment: 25000 },
        { upTo: 200000, increment: 50000 },
        { increment: 100000 },
      ]),
    }, "rupee");
    expect(rupeeLines[0]).toContain("Up to ₹1.00L");
    expect(rupeeLines.at(-1)).toContain("Above ₹2.00L");
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

  it("returns zero planning rows when squad target is met", () => {
    expect(computeTeamReportPlanningRows(10, 10, 0)).toEqual({
      planningRows: 0,
      slotsRemaining: 0,
    });
    expect(computeTeamReportPlanningRows(12, 10, 12)).toEqual({
      planningRows: 0,
      slotsRemaining: 0,
    });
  });

  it("provides 8 planning rows when no limits are set and team has no players", () => {
    expect(computeTeamReportPlanningRows(0, 0, 0)).toEqual({
      planningRows: 8,
      slotsRemaining: 0,
    });
  });

  it("returns zero planning rows when no limits are set but team already has acquired players", () => {
    expect(computeTeamReportPlanningRows(10, 0, 0)).toEqual({
      planningRows: 0,
      slotsRemaining: 0,
    });
  });
});
