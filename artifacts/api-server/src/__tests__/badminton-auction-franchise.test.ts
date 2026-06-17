import { describe, expect, it, vi, beforeEach } from "vitest";

const selectResults: unknown[][] = [];

vi.mock("@workspace/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(selectResults.shift() ?? []),
  };

  return {
    db: {
      select: () => chain,
    },
    playersTable: {
      id: "id",
      tournamentId: "tournamentId",
      teamId: "teamId",
      status: "status",
      globalPlayerId: "globalPlayerId",
    },
    teamsTable: {
      id: "id",
      tournamentId: "tournamentId",
      name: "name",
      logoUrl: "logoUrl",
    },
  };
});

import { resolveAuctionFranchiseForMasterPlayer } from "../lib/master-sports/badminton";

describe("resolveAuctionFranchiseForMasterPlayer", () => {
  beforeEach(() => {
    selectResults.length = 0;
  });

  it("returns franchise from sold auction player linked by globalPlayerId", async () => {
    selectResults.push(
      [{ teamId: 2, status: "sold" }],
      [{ name: "Vyapari Warriors", logoUrl: "https://logo.png" }],
    );

    const result = await resolveAuctionFranchiseForMasterPlayer(
      { id: "gp_1", auctionPlayerId: null } as never,
      5,
    );

    expect(result).toEqual({
      franchiseName: "Vyapari Warriors",
      franchiseLogoUrl: "https://logo.png",
    });
  });

  it("returns null when auction player is available (not sold)", async () => {
    selectResults.push([{ teamId: null, status: "available" }]);

    const result = await resolveAuctionFranchiseForMasterPlayer(
      { id: "gp_2", auctionPlayerId: 11 } as never,
      5,
    );

    expect(result).toEqual({ franchiseName: null, franchiseLogoUrl: null });
  });
});
