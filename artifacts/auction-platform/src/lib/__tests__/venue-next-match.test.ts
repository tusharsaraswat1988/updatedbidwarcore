import { describe, expect, it } from "vitest";
import {
  coerceBroadcastSideInfo,
  findUpNextMatch,
  matchIdentityLine,
  resolveBroadcastMatchSides,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";

function match(partial: Partial<BroadcastConsoleMatch> & { id: number }): BroadcastConsoleMatch {
  return {
    status: "scheduled",
    detail: null,
    state: null,
    ...partial,
  };
}

describe("resolveBroadcastMatchSides", () => {
  it("uses detail side JSON when state snapshot is missing", () => {
    const m = match({
      id: 2,
      detail: {
        courtNumber: "CO1",
        matchLabel: "Group 1 Males · Match 2",
        matchType: "singles",
        leftSideJson: {
          label: "Rohit Sharma",
          shortLabel: "Sharma",
          franchiseName: "Warriors",
          playerIds: [1],
        },
        rightSideJson: {
          label: "Virat Kohli",
          shortLabel: "Kohli",
          franchiseName: "Titans",
          playerIds: [2],
        },
      },
    });

    const sides = resolveBroadcastMatchSides(m);
    expect(sides?.left.label).toBe("Rohit Sharma");
    expect(sides?.right.label).toBe("Virat Kohli");
    expect(sides?.matchKind).toBe("singles");
    expect(matchIdentityLine(m)).toContain("Rohit Sharma");
    expect(matchIdentityLine(m)).toContain("Virat Kohli");
  });

  it("prefers state snapshot over detail JSON", () => {
    const m = match({
      id: 3,
      state: {
        matchKind: "singles",
        leftSide: { label: "Live Left", shortLabel: "LL", playerIds: [1] },
        rightSide: { label: "Live Right", shortLabel: "LR", playerIds: [2] },
      } as BroadcastConsoleMatch["state"],
      detail: {
        leftSideJson: { label: "Detail Left", shortLabel: "DL", playerIds: [1] },
        rightSideJson: { label: "Detail Right", shortLabel: "DR", playerIds: [2] },
      },
    });

    expect(resolveBroadcastMatchSides(m)?.left.label).toBe("Live Left");
  });
});

describe("findUpNextMatch", () => {
  it("prefers same court as primary live match", () => {
    const live = match({
      id: 1,
      status: "live",
      detail: { courtId: 10, courtNumber: "CO1" },
    });
    const otherCourt = match({
      id: 2,
      scheduledAt: "2026-01-01T10:00:00.000Z",
      detail: { courtId: 11, courtNumber: "CO2", matchLabel: "Other" },
    });
    const sameCourt = match({
      id: 3,
      scheduledAt: "2026-01-01T11:00:00.000Z",
      detail: { courtId: 10, courtNumber: "CO1", matchLabel: "Same court later" },
    });

    expect(findUpNextMatch([live, otherCourt, sameCourt], 1)?.id).toBe(3);
  });
});

describe("coerceBroadcastSideInfo", () => {
  it("returns null for empty sides", () => {
    expect(coerceBroadcastSideInfo({})).toBeNull();
    expect(coerceBroadcastSideInfo(null)).toBeNull();
  });
});
