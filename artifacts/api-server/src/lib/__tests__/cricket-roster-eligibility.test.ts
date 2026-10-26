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
  rosterAssignmentCoversPlayer,
  rosterTypeFromPlayer,
} from "../master-sports/cricket-roster";
import { masterIdentityAvailable } from "../master-sports/master-identity";

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

describe("rosterAssignmentCoversPlayer", () => {
  const player = { id: 105, teamId: 83 };
  const masterTeamId = "mt_lfi";

  it("accepts the same player already assigned to this franchise team", () => {
    expect(
      rosterAssignmentCoversPlayer(
        { teamId: masterTeamId, auctionTeamId: 83, auctionPlayerId: 105 },
        masterTeamId,
        player,
      ),
    ).toBe(true);
  });

  it("does not treat a teammate who shares the master id as already assigned", () => {
    expect(
      rosterAssignmentCoversPlayer(
        { teamId: masterTeamId, auctionTeamId: 83, auctionPlayerId: 104 },
        masterTeamId,
        player,
      ),
    ).toBe(false);
  });

  it("does not skip a player whose assignment is on a different team", () => {
    expect(
      rosterAssignmentCoversPlayer(
        { teamId: "mt_other", auctionTeamId: 88, auctionPlayerId: 105 },
        masterTeamId,
        player,
      ),
    ).toBe(false);
  });
});

describe("masterIdentityAvailable", () => {
  it("blocks merging into a master id already used by another player", () => {
    expect(masterIdentityAvailable("gp_sibling", new Set(["gp_sibling"]))).toBe(false);
    expect(masterIdentityAvailable("gp_new", new Set(["gp_sibling"]))).toBe(true);
    expect(masterIdentityAvailable("gp_any")).toBe(true);
  });
});

describe("rosterTypeFromPlayer", () => {
  it("maps retained and sold to auction assignment types", () => {
    expect(rosterTypeFromPlayer({ status: "retained" })).toBe("retained");
    expect(rosterTypeFromPlayer({ status: "sold" })).toBe("auction_sale");
  });

  it("maps scoring-mode available team assignment to transfer PTA", () => {
    expect(rosterTypeFromPlayer({ status: "available" })).toBe("transfer");
    expect(rosterTypeFromPlayer({ status: "unsold" })).toBe("transfer");
  });
});
