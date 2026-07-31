import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockUpdateWhere, mockInsertValues } = vi.hoisted(() => ({
  mockUpdateWhere: vi.fn().mockResolvedValue([]),
  mockInsertValues: vi.fn().mockResolvedValue([]),
}));

vi.mock("@workspace/db", () => ({
  db: {
    update: () => ({
      set: () => ({ where: mockUpdateWhere }),
    }),
    insert: () => ({
      values: mockInsertValues,
    }),
  },
  playerTeamAssignmentsTable: {
    playerId: "playerId",
    tournamentId: "tournamentId",
    sport: "sport",
    isActive: "isActive",
  },
  masterSportsSyncLogTable: {
    action: "action",
  },
}));

import {
  assignPlayerToFranchiseRoster,
  endActiveRosterAssignment,
} from "@workspace/player-registry/roster-assignments";

describe("cricket roster assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("endActiveRosterAssignment skips empty master id", async () => {
    await endActiveRosterAssignment("", 1, "cricket");
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("endActiveRosterAssignment deactivates active rows for the given sport", async () => {
    await endActiveRosterAssignment("gp_1", 42, "cricket");
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("endActiveRosterAssignment scopes by sport so badminton rows are untouched", async () => {
    await endActiveRosterAssignment("gp_1", 42, "badminton");
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("assignPlayerToFranchiseRoster ends prior row then inserts", async () => {
    await assignPlayerToFranchiseRoster({
      masterPlayerId: "gp_1",
      masterTeamId: "mt_1",
      tournamentId: 10,
      auctionPlayerId: 5,
      auctionTeamId: 2,
      assignmentType: "auction_sale",
      sport: "cricket",
    });

    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: "gp_1",
        teamId: "mt_1",
        tournamentId: 10,
        sport: "cricket",
        assignmentType: "auction_sale",
        isActive: true,
        auctionPlayerId: 5,
      }),
    );
  });

  it("transfer assignment type is persisted", async () => {
    await assignPlayerToFranchiseRoster({
      masterPlayerId: "gp_2",
      masterTeamId: "mt_3",
      tournamentId: 10,
      auctionPlayerId: 8,
      auctionTeamId: 4,
      assignmentType: "transfer",
      sport: "badminton",
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentType: "transfer" }),
    );
  });

  it("allows null auctionPlayerId for registry-only badminton assigns", async () => {
    await assignPlayerToFranchiseRoster({
      masterPlayerId: "gp_3",
      masterTeamId: "mt_4",
      tournamentId: 10,
      auctionPlayerId: null,
      auctionTeamId: 7,
      assignmentType: "transfer",
      sport: "badminton",
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionPlayerId: null,
        auctionTeamId: 7,
        sport: "badminton",
      }),
    );
  });
});
