import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectChain = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => mockSelectChain),
  },
  globalPlayersTable: { id: "id", auctionPlayerId: "auctionPlayerId" },
  playersTable: {
    globalPlayerId: "globalPlayerId",
    id: "id",
    tournamentId: "tournamentId",
    status: "status",
    serialNo: "serialNo",
    teamId: "teamId",
  },
  badmintonPlayersTable: {
    masterPlayerId: "masterPlayerId",
    tournamentId: "tournamentId",
    id: "id",
  },
  playerTeamAssignmentsTable: {
    playerId: "playerId",
    tournamentId: "tournamentId",
    isActive: "isActive",
    assignedAt: "assignedAt",
  },
}));

import { db } from "@workspace/db";
import {
  mergeUniqueMasterPlayerIds,
  getAuctionRegistryMasterPlayerIds,
  resolveImportSourceMasterPlayerIds,
} from "../lib/master-sports/badminton";

describe("badminton import source resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mergeUniqueMasterPlayerIds preserves order and dedupes", () => {
    expect(mergeUniqueMasterPlayerIds(["gp_a", "gp_b"], ["gp_b", "gp_c"])).toEqual([
      "gp_a",
      "gp_b",
      "gp_c",
    ]);
  });

  it("getAuctionRegistryMasterPlayerIds returns linked global player ids in serial order", async () => {
    const orderBy = vi.fn().mockResolvedValue([
      { globalPlayerId: "gp_1", auctionPlayerId: 10 },
      { globalPlayerId: null, auctionPlayerId: 11 },
      { globalPlayerId: "gp_3", auctionPlayerId: 12 },
    ]);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    mockSelectChain.from = from;

    vi.mocked(db.select).mockImplementationOnce(() => ({ from }) as never);

    const linkedWhere = vi.fn().mockResolvedValue([{ id: "gp_2", auctionPlayerId: 11 }]);
    const linkedFrom = vi.fn(() => ({ where: linkedWhere }));
    vi.mocked(db.select).mockImplementationOnce(() => ({ from: linkedFrom }) as never);

    const ids = await getAuctionRegistryMasterPlayerIds(1);
    expect(ids).toEqual(["gp_1", "gp_2", "gp_3"]);
  });

  it("resolveImportSourceMasterPlayerIds prefers auction roster over registry and badminton", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return {
          from: () => ({
            where: () => ({
              orderBy: vi.fn().mockResolvedValue([
                { globalPlayerId: "gp_auction_a", auctionPlayerId: 5 },
                { globalPlayerId: "gp_auction_b", auctionPlayerId: 6 },
              ]),
            }),
          }),
        } as never;
      }
      return { from: () => ({ where: () => ({ orderBy: vi.fn().mockResolvedValue([]) }) }) } as never;
    });

    const ids = await resolveImportSourceMasterPlayerIds(42);
    expect(ids).toEqual(["gp_auction_a", "gp_auction_b"]);
    expect(call).toBe(1);
  });

  it("resolveImportSourceMasterPlayerIds falls back to registry and badminton when auction is empty", async () => {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return {
          from: () => ({
            where: () => ({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never;
      }
      if (call === 2) {
        return {
          from: () => ({
            where: () => ({
              orderBy: vi.fn().mockResolvedValue([{ playerId: "gp_pta" }]),
            }),
          }),
        } as never;
      }
      if (call === 3) {
        return {
          from: () => ({
            where: () => ({
              orderBy: vi.fn().mockResolvedValue([{ masterPlayerId: "gp_badminton" }]),
            }),
          }),
        } as never;
      }
      return { from: () => ({ where: () => ({ orderBy: vi.fn().mockResolvedValue([]) }) }) } as never;
    });

    const ids = await resolveImportSourceMasterPlayerIds(42);
    expect(ids).toEqual(["gp_pta", "gp_badminton"]);
  });
});
