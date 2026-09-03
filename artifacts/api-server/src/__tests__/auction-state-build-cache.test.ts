import { describe, expect, it, beforeEach } from "vitest";
import {
  createBuildTimings,
  formatAuctionStateFlamegraph,
  getCachedRoster,
  getCachedStatic,
  invalidateAuctionBuildCache,
  resetAuctionBuildCacheForTests,
  setCachedRoster,
  setCachedStatic,
} from "../lib/auction-state-build-cache";

describe("auction state build cache", () => {
  beforeEach(() => {
    resetAuctionBuildCacheForTests();
  });

  it("formats flamegraph-style timing output", () => {
    const timings = createBuildTimings();
    timings.players = 45;
    timings.teams = 12;
    timings.purses = 80;
    timings.serialization = 5;
    timings.total = 142;
    timings.cacheHits = { static: true, roster: true };

    const output = formatAuctionStateFlamegraph(timings);
    expect(output).toContain("Players");
    expect(output).toContain("45 ms");
    expect(output).toContain("Teams");
    expect(output).toContain("Purses");
    expect(output).toContain("Total");
    expect(output).toContain("142 ms");
    expect(output).toContain("static✓");
    expect(output).toContain("roster✓");
  });

  it("invalidates static and roster caches independently", () => {
    setCachedStatic(1, {
      tournament: {
        playerSelectionMode: "sequential",
        timerSeconds: 30,
        bidTimerSeconds: 15,
        bidExtensionEnabled: false,
        bidExtensionThresholdSeconds: 3,
        bidExtensionSeconds: 5,
        bidTier1UpTo: 100000,
        bidTier1Increment: 25000,
        bidTier2UpTo: 200000,
        bidTier2Increment: 50000,
        bidTier3Increment: 100000,
        bidTiers: null,
        licenseStatus: "active",
        minimumSquadSize: 11,
        maximumSquadSize: 15,
        minBid: 20000,
        sponsorLogos: null,
      },
      tiers: [{ increment: 25000 }],
    });

    setCachedRoster(1, {
      teams: [],
      counts: { soldCount: 0, unsoldCount: 0, availableCount: 10 },
      rosterPlayers: [],
      purses: [],
    });

    invalidateAuctionBuildCache(1, "roster");
    expect(getCachedStatic(1)).toBeTruthy();
    expect(getCachedRoster(1)).toBeNull();

    invalidateAuctionBuildCache(1, "static");
    expect(getCachedStatic(1)).toBeNull();
  });

  it("all-scope invalidation drops cached purses so min-squad settings cannot stick at reserve=0", () => {
    setCachedRoster(1, {
      teams: [],
      counts: { soldCount: 0, unsoldCount: 0, availableCount: 10 },
      rosterPlayers: [],
      purses: [{
        teamId: 1,
        teamName: "A",
        shortCode: "A",
        color: null,
        logoUrl: null,
        originalPurse: 1_500_000,
        boosterTotal: 0,
        effectiveCapacity: 1_500_000,
        purse: 1_500_000,
        purseUsed: 0,
        purseRemaining: 1_500_000,
        playersBought: 0,
        retainedCount: 0,
        reservePurse: 0,
        spendablePurse: 1_500_000,
        slotsRequired: 0,
        futurePlayersBought: 1,
        futureSlotsRequired: 0,
        futureReservePurse: 0,
        maxAllowedBid: 1_500_000,
        lowestBasePrice: 0,
        minimumSquadSize: 0,
        maximumSquadSize: 0,
        topPlayerName: null,
        topPlayerAmount: null,
      }],
    });
    invalidateAuctionBuildCache(1, "all");
    expect(getCachedRoster(1)).toBeNull();
    expect(getCachedStatic(1)).toBeNull();
  });
});
