import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  auctionSessionsTable: {
    tournamentId: "tournament_id",
    deferredPlayerIds: "deferred_player_ids",
    randomDrawQueue: "random_draw_queue",
    currentPlayerId: "current_player_id",
    currentBid: "current_bid",
    currentBidTeamId: "current_bid_team_id",
    timerEndsAt: "timer_ends_at",
    timerType: "timer_type",
    pausedTimeRemaining: "paused_time_remaining",
    lastAction: "last_action",
    lastOutcome: "last_outcome",
  },
  playersTable: {
    id: "id",
    tournamentId: "tournament_id",
    teamId: "team_id",
    status: "status",
  },
  tournamentsTable: {
    id: "id",
    registrationLimit: "registration_limit",
    status: "status",
  },
}));

vi.mock("../lib/player-purse", () => ({
  recalcTeamPurseUsed: vi.fn(),
}));

import { db } from "@workspace/db";
import { recalcTeamPurseUsed } from "../lib/player-purse";
import {
  applyPublicWithdrawnReRegistration,
  reinstateTournamentPlayer,
  withdrawTournamentPlayer,
} from "../lib/player-withdrawal";

type MockPlayer = {
  id: number;
  tournamentId: number;
  status: string;
  teamId: number | null;
  soldPrice: number | null;
  retainedPrice: number | null;
  playerTag: string | null;
  playerTagTeamId: number | null;
  categoryId: number;
  serialNo: number;
  basePrice: number;
  selectedBidValue: number | null;
  bidValueSource: string | null;
  globalPlayerId: string | null;
  name: string;
};

function makePlayer(overrides: Partial<MockPlayer> = {}): MockPlayer {
  return {
    id: 10,
    tournamentId: 1,
    status: "available",
    teamId: null,
    soldPrice: null,
    retainedPrice: null,
    playerTag: "captain",
    playerTagTeamId: 5,
    categoryId: 3,
    serialNo: 7,
    basePrice: 200000,
    selectedBidValue: 200000,
    bidValueSource: "player",
    globalPlayerId: "gp-1",
    name: "Test Player",
    ...overrides,
  };
}

function chainSelectLimit(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

function chainSelectWhere(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

describe("withdrawTournamentPlayer auction field preservation", () => {
  let capturedSet: Record<string, unknown> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSet = null;
    vi.mocked(db.select).mockReturnValue(chainSelectLimit([]) as never);
    vi.mocked(db.update).mockImplementation(() => {
      const returning = vi.fn().mockResolvedValue([
        { ...makePlayer(), status: "withdrawn", playerTag: "captain", playerTagTeamId: 5 },
      ]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn((patch: Record<string, unknown>) => {
        capturedSet = patch;
        return { where };
      });
      return { set } as never;
    });
  });

  it("preserves cosmetic tags and only clears roster fields when set", async () => {
    const player = makePlayer({ teamId: 2, soldPrice: 100, retainedPrice: 50 });
    const result = await withdrawTournamentPlayer(1, player as never);

    expect(result.ok).toBe(true);
    expect(capturedSet).toEqual({
      status: "withdrawn",
      teamId: null,
      soldPrice: null,
      retainedPrice: null,
    });
    expect(capturedSet).not.toHaveProperty("playerTag");
    expect(capturedSet).not.toHaveProperty("playerTagTeamId");
    expect(capturedSet).not.toHaveProperty("categoryId");
    expect(capturedSet).not.toHaveProperty("basePrice");
    expect(recalcTeamPurseUsed).toHaveBeenCalledWith(1, 2);
  });
});

describe("reinstateTournamentPlayer registration limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails gracefully when registration limit is reached", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        chainSelectLimit([{ registrationLimit: 2, status: "setup" }]) as never,
      )
      .mockReturnValueOnce(chainSelectWhere([{ count: 2 }]) as never);

    const result = await reinstateTournamentPlayer(1, makePlayer({ status: "withdrawn" }) as never);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REGISTRATION_LIMIT_REACHED");
      expect(result.status).toBe(403);
    }
  });

  it("only updates status when reinstating", async () => {
    let capturedSet: Record<string, unknown> | null = null;

    vi.mocked(db.select)
      .mockReturnValueOnce(
        chainSelectLimit([{ registrationLimit: null, status: "setup" }]) as never,
      );

    vi.mocked(db.update).mockImplementation(() => {
      const returning = vi.fn().mockResolvedValue([
        { ...makePlayer({ status: "available" }), playerTag: "captain" },
      ]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn((patch: Record<string, unknown>) => {
        capturedSet = patch;
        return { where };
      });
      return { set } as never;
    });

    const result = await reinstateTournamentPlayer(1, makePlayer({ status: "withdrawn" }) as never);

    expect(result.ok).toBe(true);
    expect(capturedSet).toEqual({ status: "available" });
  });
});

describe("applyPublicWithdrawnReRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not reinstate when auto-approve is disabled", async () => {
    const player = makePlayer({ status: "withdrawn" });
    const result = await applyPublicWithdrawnReRegistration(1, player as never, false);

    expect(result.reinstated).toBe(false);
    expect(result.requiresOrganizerApproval).toBe(true);
    expect(result.player.status).toBe("withdrawn");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("reinstates when auto-approve is enabled and limit allows", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        chainSelectLimit([{ registrationLimit: null, status: "setup" }]) as never,
      );

    vi.mocked(db.update).mockImplementation(() => {
      const returning = vi.fn().mockResolvedValue([
        makePlayer({ status: "available" }),
      ]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      return { set } as never;
    });

    const player = makePlayer({ status: "withdrawn" });
    const result = await applyPublicWithdrawnReRegistration(1, player as never, true);

    expect(result.reinstated).toBe(true);
    expect(result.requiresOrganizerApproval).toBe(false);
    expect(result.player.status).toBe("available");
  });

  it("requires organizer approval when auto-approve is enabled but limit blocks reinstate", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        chainSelectLimit([{ registrationLimit: 1, status: "setup" }]) as never,
      )
      .mockReturnValueOnce(chainSelectWhere([{ count: 1 }]) as never);

    const player = makePlayer({ status: "withdrawn" });
    const result = await applyPublicWithdrawnReRegistration(1, player as never, true);

    expect(result.reinstated).toBe(false);
    expect(result.requiresOrganizerApproval).toBe(true);
    expect(result.reinstateBlockedCode).toBe("REGISTRATION_LIMIT_REACHED");
  });
});
