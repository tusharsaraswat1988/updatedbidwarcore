import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  playersTable: {
    status: "status",
    soldPrice: "sold_price",
    retainedPrice: "retained_price",
    basePrice: "base_price",
    tournamentId: "tournament_id",
    teamId: "team_id",
  },
  teamsTable: {
    id: "id",
    purseUsed: "purse_used",
  },
}));

import { db } from "@workspace/db";
import { recalcTeamPurseUsed } from "../lib/player-purse";

function chainSelectWhere(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

describe("recalcTeamPurseUsed", () => {
  let capturedPurseUsed: number | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPurseUsed = null;
    vi.mocked(db.select).mockReturnValue(chainSelectWhere([]) as never);
    vi.mocked(db.update).mockImplementation(() => {
      const where = vi.fn().mockResolvedValue(undefined);
      const set = vi.fn((patch: { purseUsed: number }) => {
        capturedPurseUsed = patch.purseUsed;
        return { where };
      });
      return { set } as never;
    });
  });

  it("sums sold and retained spend only", async () => {
    vi.mocked(db.select).mockReturnValue(
      chainSelectWhere([
        { status: "sold", soldPrice: 500_000, retainedPrice: null, basePrice: 100_000 },
        { status: "retained", soldPrice: null, retainedPrice: 200_000, basePrice: 100_000 },
        { status: "available", soldPrice: null, retainedPrice: 300_000, basePrice: 100_000 },
      ]) as never,
    );

    await recalcTeamPurseUsed(1, 9);

    expect(capturedPurseUsed).toBe(700_000);
  });

  it("returns zero when roster is empty", async () => {
    await recalcTeamPurseUsed(1, 9);
    expect(capturedPurseUsed).toBe(0);
  });
});
