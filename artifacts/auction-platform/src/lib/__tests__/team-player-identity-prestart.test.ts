import { describe, expect, it } from "vitest";
import {
  identityForPreStartMatchSide,
  isPlaceholderPlayerName,
} from "@/lib/team-player-identity";

describe("isPlaceholderPlayerName", () => {
  it("detects reducer defaults", () => {
    expect(isPlaceholderPlayerName("Player A")).toBe(true);
    expect(isPlaceholderPlayerName("Player B")).toBe(true);
    expect(isPlaceholderPlayerName("Player 1")).toBe(true);
    expect(isPlaceholderPlayerName("Side A")).toBe(true);
    expect(isPlaceholderPlayerName("TBD")).toBe(true);
    expect(isPlaceholderPlayerName("")).toBe(true);
  });

  it("allows real names", () => {
    expect(isPlaceholderPlayerName("Sagar Baranwal & Rohit Pathak")).toBe(false);
    expect(isPlaceholderPlayerName("Rohit Sharma")).toBe(false);
  });
});

describe("identityForPreStartMatchSide", () => {
  it("falls back to detail roster when state still has Player A/B", () => {
    const identity = identityForPreStartMatchSide(
      { label: "Player A", shortLabel: "A", playerIds: [] },
      {
        label: "Sagar Baranwal & Rohit Pathak",
        shortLabel: "SB & RP",
        franchiseName: "STOCKTECH SMASHERS",
        playerIds: [1, 2],
      },
    );
    expect(identity.playerName).toBe("Sagar Baranwal & Rohit Pathak");
    expect(identity.teamName).toBe("STOCKTECH SMASHERS");
  });

  it("keeps live state names when they are real", () => {
    const identity = identityForPreStartMatchSide(
      { label: "Live Pair", shortLabel: "LP", playerIds: [1], franchiseName: "Titans" },
      { label: "Detail Pair", franchiseName: "Warriors", playerIds: [9] },
    );
    expect(identity.playerName).toBe("Live Pair");
    expect(identity.teamName).toBe("Titans");
  });
});
