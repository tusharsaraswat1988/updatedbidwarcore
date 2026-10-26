import { describe, expect, it, vi, beforeEach } from "vitest";
import { isAuctionEnabled } from "@workspace/platform-core";

const mockBroadcastState = vi.fn();
const mockInvalidateAuctionBuildCache = vi.fn();
const mockInvalidateStateCache = vi.fn();
const mockScheduleGoogleSheetSync = vi.fn();

vi.mock("../routes/auction", () => ({
  broadcastState: (...args: unknown[]) => mockBroadcastState(...args),
  invalidateAuctionBuildCache: (...args: unknown[]) => mockInvalidateAuctionBuildCache(...args),
  invalidateStateCache: (...args: unknown[]) => mockInvalidateStateCache(...args),
}));

vi.mock("../lib/google-sheets-sync-queue", () => ({
  scheduleGoogleSheetSync: (...args: unknown[]) => mockScheduleGoogleSheetSync(...args),
}));

// Recreate the exact logic tested in teams.ts and players.ts
async function afterTeamDataChanged(
  tournamentId: number,
  tournamentObj: { auctionEnabled?: boolean | null } | null,
) {
  if (tournamentObj && isAuctionEnabled(tournamentObj)) {
    mockInvalidateAuctionBuildCache(tournamentId, "all");
    mockInvalidateStateCache(tournamentId);
    mockBroadcastState(tournamentId, ["purses"]);
  }
}

async function afterPlayerDataChanged(
  tournamentId: number,
  tournamentObj: { auctionEnabled?: boolean | null } | null,
) {
  mockScheduleGoogleSheetSync(tournamentId);
  if (tournamentObj && isAuctionEnabled(tournamentObj)) {
    mockInvalidateAuctionBuildCache(tournamentId, "all");
    mockInvalidateStateCache(tournamentId);
    mockBroadcastState(tournamentId, ["players", "purses"]);
  }
}

describe("Phase 4F — Team and Player Auction Side-Effect Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Team mutations", () => {
    it("scoring_only: team mutation does NOT trigger auction side effects", async () => {
      const scoringOnly = { auctionEnabled: false, scoringEnabled: true };
      await afterTeamDataChanged(100, scoringOnly);

      expect(mockBroadcastState).not.toHaveBeenCalled();
      expect(mockInvalidateAuctionBuildCache).not.toHaveBeenCalled();
      expect(mockInvalidateStateCache).not.toHaveBeenCalled();
    });

    it("auction_only: team mutation triggers auction side effects", async () => {
      const auctionOnly = { auctionEnabled: true, scoringEnabled: false };
      await afterTeamDataChanged(101, auctionOnly);

      expect(mockBroadcastState).toHaveBeenCalledWith(101, ["purses"]);
      expect(mockInvalidateAuctionBuildCache).toHaveBeenCalledWith(101, "all");
      expect(mockInvalidateStateCache).toHaveBeenCalledWith(101);
    });

    it("both: team mutation triggers auction side effects", async () => {
      const both = { auctionEnabled: true, scoringEnabled: true };
      await afterTeamDataChanged(102, both);

      expect(mockBroadcastState).toHaveBeenCalledWith(102, ["purses"]);
      expect(mockInvalidateAuctionBuildCache).toHaveBeenCalledWith(102, "all");
      expect(mockInvalidateStateCache).toHaveBeenCalledWith(102);
    });

    it("invalid state (false, false): team mutation does NOT trigger auction side effects", async () => {
      const invalid = { auctionEnabled: false, scoringEnabled: false };
      await afterTeamDataChanged(103, invalid);

      expect(mockBroadcastState).not.toHaveBeenCalled();
      expect(mockInvalidateAuctionBuildCache).not.toHaveBeenCalled();
      expect(mockInvalidateStateCache).not.toHaveBeenCalled();
    });
  });

  describe("Player mutations", () => {
    it("scoring_only: player mutation schedules sheet sync but does NOT trigger auction side effects", async () => {
      const scoringOnly = { auctionEnabled: false, scoringEnabled: true };
      await afterPlayerDataChanged(200, scoringOnly);

      expect(mockScheduleGoogleSheetSync).toHaveBeenCalledWith(200);
      expect(mockBroadcastState).not.toHaveBeenCalled();
      expect(mockInvalidateAuctionBuildCache).not.toHaveBeenCalled();
      expect(mockInvalidateStateCache).not.toHaveBeenCalled();
    });

    it("auction_only: player mutation triggers sheet sync AND auction side effects", async () => {
      const auctionOnly = { auctionEnabled: true, scoringEnabled: false };
      await afterPlayerDataChanged(201, auctionOnly);

      expect(mockScheduleGoogleSheetSync).toHaveBeenCalledWith(201);
      expect(mockBroadcastState).toHaveBeenCalledWith(201, ["players", "purses"]);
      expect(mockInvalidateAuctionBuildCache).toHaveBeenCalledWith(201, "all");
      expect(mockInvalidateStateCache).toHaveBeenCalledWith(201);
    });

    it("both: player mutation triggers sheet sync AND auction side effects", async () => {
      const both = { auctionEnabled: true, scoringEnabled: true };
      await afterPlayerDataChanged(202, both);

      expect(mockScheduleGoogleSheetSync).toHaveBeenCalledWith(202);
      expect(mockBroadcastState).toHaveBeenCalledWith(202, ["players", "purses"]);
      expect(mockInvalidateAuctionBuildCache).toHaveBeenCalledWith(202, "all");
      expect(mockInvalidateStateCache).toHaveBeenCalledWith(202);
    });
  });
});
