import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  playersTable: {},
  teamsTable: {},
  tournamentsTable: {},
  playerTeamAssignmentsTable: {},
}));

vi.mock("@workspace/player-registry/sync-helpers", () => ({
  logSync: vi.fn(),
}));

vi.mock("@workspace/player-registry/roster-assignments", () => ({
  assignPlayerToFranchiseRoster: vi.fn(),
  endActiveRosterAssignment: vi.fn(),
}));

vi.mock("@workspace/player-registry/cricket-franchise", () => ({
  listCricketFranchisePlayers: vi.fn(),
  listCricketFranchiseTeams: vi.fn(),
}));

vi.mock("../master-sports/sync", () => ({
  syncAuctionPlayerToMaster: vi.fn(),
  syncAuctionTeamToMaster: vi.fn(),
  syncAllAuctionPlayersToMaster: vi.fn(),
}));

vi.mock("../master-sports/cricket-stats", () => ({
  ensureCricketStatisticsBaseline: vi.fn(),
}));

import {
  isFranchiseRosterEligible,
  rosterTypeFromPlayer,
} from "../master-sports/cricket-roster";

describe("isFranchiseRosterEligible", () => {
  it("requires a team assignment", () => {
    expect(
      isFranchiseRosterEligible({ teamId: null, isNonPlayingMember: false }),
    ).toBe(false);
  });

  it("includes team-assigned players regardless of auction sold status", () => {
    expect(
      isFranchiseRosterEligible({ teamId: 7, isNonPlayingMember: false }),
    ).toBe(true);
  });

  it("excludes non-playing members even with a teamId", () => {
    expect(
      isFranchiseRosterEligible({ teamId: 7, isNonPlayingMember: true }),
    ).toBe(false);
  });
});

describe("rosterTypeFromPlayer", () => {
  it("maps retained and sold to auction assignment types", () => {
    expect(rosterTypeFromPlayer({ status: "retained" })).toBe("retained");
    expect(rosterTypeFromPlayer({ status: "sold" })).toBe("auction_sale");
  });

  it("maps direct Sports / available assignments to transfer", () => {
    expect(rosterTypeFromPlayer({ status: "available" })).toBe("transfer");
    expect(rosterTypeFromPlayer({ status: "unsold" })).toBe("transfer");
  });
});
