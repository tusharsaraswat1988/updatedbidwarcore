import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  auctionSessionsTable: {
    currentPlayerId: "current_player_id",
    deferredPlayerIds: "deferred_player_ids",
    tournamentId: "tournament_id",
  },
  bidsTable: { tournamentId: "tournament_id", playerId: "player_id" },
  playersTable: { id: "id", tournamentId: "tournament_id", teamId: "team_id", status: "status" },
}));

vi.mock("../lib/player-specification-service", () => ({
  playerSpecificationService: {
    deletePlayerSpecifications: vi.fn(),
  },
}));

import { db } from "@workspace/db";
import { validatePlayerDeletable } from "../lib/player-delete-guard";

function chainSelectWhere(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

function chainSelectLimit(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

describe("validatePlayerDeletable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks players with auction roster status sold", async () => {
    const result = await validatePlayerDeletable(1, { id: 10, status: "sold", teamId: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLAYER_IN_AUCTION_ROSTER");
      expect(result.status).toBe(409);
    }
  });

  it("blocks players with auction roster status retained", async () => {
    const result = await validatePlayerDeletable(1, { id: 10, status: "retained", teamId: 5 });
    expect(result.ok).toBe(false);
  });

  it("blocks players with auction roster status unsold", async () => {
    const result = await validatePlayerDeletable(1, { id: 10, status: "unsold", teamId: null });
    expect(result.ok).toBe(false);
  });

  it("allows available players when no bids or auction block", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chainSelectWhere([{ bidCount: 0 }]) as never)
      .mockReturnValueOnce(chainSelectLimit([]) as never);

    const result = await validatePlayerDeletable(1, { id: 10, status: "available", teamId: null });
    expect(result.ok).toBe(true);
  });

  it("blocks when player has bid history", async () => {
    vi.mocked(db.select).mockReturnValue(chainSelectWhere([{ bidCount: 2 }]) as never);

    const result = await validatePlayerDeletable(1, { id: 10, status: "available", teamId: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLAYER_HAS_BIDS");
    }
  });

  it("blocks when player is on the auction block", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chainSelectWhere([{ bidCount: 0 }]) as never)
      .mockReturnValueOnce(
        chainSelectLimit([{ currentPlayerId: 10, deferredPlayerIds: null }]) as never,
      );

    const result = await validatePlayerDeletable(1, { id: 10, status: "available", teamId: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLAYER_ON_AUCTION_BLOCK");
    }
  });
});
