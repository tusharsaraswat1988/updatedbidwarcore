import { beforeEach, describe, expect, it, vi } from "vitest";

const syncAuctionPlayerToMaster = vi.fn();
const ensureBadmintonPlayerFromMaster = vi.fn();
const adaptScoringPlayerToBadmintonRegistration = vi.fn();

vi.mock("../master-sports/sync", () => ({
  syncAuctionPlayerToMaster: (...args: unknown[]) => syncAuctionPlayerToMaster(...args),
}));

vi.mock("../master-sports/badminton", () => ({
  ensureBadmintonPlayerFromMaster: (...args: unknown[]) => ensureBadmintonPlayerFromMaster(...args),
}));

vi.mock("../master-sports/badminton-scoring-registration", () => ({
  adaptScoringPlayerToBadmintonRegistration: (...args: unknown[]) =>
    adaptScoringPlayerToBadmintonRegistration(...args),
}));

import { afterScoringPlayerRegistered, ScoringHandoffError } from "../scoring-registration-handoff";

describe("afterScoringPlayerRegistered", () => {
  beforeEach(() => {
    syncAuctionPlayerToMaster.mockReset();
    ensureBadmintonPlayerFromMaster.mockReset();
    adaptScoringPlayerToBadmintonRegistration.mockReset();
    syncAuctionPlayerToMaster.mockResolvedValue({ masterPlayerId: "mp_1" });
    ensureBadmintonPlayerFromMaster.mockResolvedValue({ id: 9, gender: "M" });
    adaptScoringPlayerToBadmintonRegistration.mockResolvedValue({
      status: "created",
      registrationId: 100,
      badmintonCategoryId: 21,
    });
  });

  it("syncs cricket players to master without creating badminton rows", async () => {
    const result = await afterScoringPlayerRegistered(12, 3, "cricket");
    expect(syncAuctionPlayerToMaster).toHaveBeenCalledWith(12, 3);
    expect(ensureBadmintonPlayerFromMaster).not.toHaveBeenCalled();
    expect(result.masterPlayerId).toBe("mp_1");
  });

  it("creates a badminton scoring player and runs the registration adapter", async () => {
    const result = await afterScoringPlayerRegistered(12, 3, "Badminton");
    expect(ensureBadmintonPlayerFromMaster).toHaveBeenCalledWith(3, "mp_1");
    expect(adaptScoringPlayerToBadmintonRegistration).toHaveBeenCalledWith({
      tournamentId: 3,
      canonicalPlayerId: 12,
      badmintonPlayer: { id: 9, gender: "M" },
    });
    expect(result.badmintonPlayerId).toBe(9);
    expect(result.badmintonRegistration?.status).toBe("created");
  });

  it("fails scoring registration when master sync has no player id", async () => {
    syncAuctionPlayerToMaster.mockResolvedValueOnce({ masterPlayerId: null });
    await expect(afterScoringPlayerRegistered(12, 3, "badminton")).rejects.toBeInstanceOf(ScoringHandoffError);
    expect(ensureBadmintonPlayerFromMaster).not.toHaveBeenCalled();
  });

  it("fails scoring registration when badminton_players creation fails", async () => {
    ensureBadmintonPlayerFromMaster.mockRejectedValueOnce(new Error("bp failed"));
    await expect(afterScoringPlayerRegistered(12, 3, "badminton")).rejects.toThrow("bp failed");
  });

  it("fails scoring registration when badminton registration insert fails", async () => {
    adaptScoringPlayerToBadmintonRegistration.mockRejectedValueOnce(new Error("reg failed"));
    await expect(afterScoringPlayerRegistered(12, 3, "badminton")).rejects.toThrow("reg failed");
  });
});
