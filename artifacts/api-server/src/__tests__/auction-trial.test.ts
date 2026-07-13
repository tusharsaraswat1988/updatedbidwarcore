import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Response } from "express";

const limit = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit,
          })),
        })),
      })),
    })),
  },
  teamsTable: { id: "id", tournamentId: "tournamentId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((...args: unknown[]) => args),
}));

import {
  assertTeamAllowedInTrialAuction,
  TRIAL_AUCTION_PARTICIPATION_ERROR,
} from "../lib/auction-trial";

describe("assertTeamAllowedInTrialAuction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response & {
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
    };
  }

  it("allows any team when license is active", async () => {
    const res = mockRes();
    await expect(
      assertTeamAllowedInTrialAuction(res, { licenseStatus: "active" }, 1, 99),
    ).resolves.toBe(true);
    expect(res.status).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it("allows eligible trial team", async () => {
    limit.mockResolvedValue([{ id: 10 }, { id: 20 }]);
    const res = mockRes();
    await expect(
      assertTeamAllowedInTrialAuction(res, { licenseStatus: "trial" }, 1, 20),
    ).resolves.toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks non-eligible trial team with 403", async () => {
    limit.mockResolvedValue([{ id: 10 }, { id: 20 }]);
    const res = mockRes();
    await expect(
      assertTeamAllowedInTrialAuction(res, { licenseStatus: "trial" }, 1, 30),
    ).resolves.toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: TRIAL_AUCTION_PARTICIPATION_ERROR });
  });
});
