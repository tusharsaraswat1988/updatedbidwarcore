import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getHomepagePageData,
  invalidateHomepageCache,
  resetHomepageCacheForTests,
} from "../homepage-page-cache.js";

describe("homepage-page-cache", () => {
  beforeEach(() => {
    resetHomepageCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cache miss on first load and hit within TTL", async () => {
    const loadFresh = vi.fn().mockResolvedValue({
      auctions: [],
      showcaseEvents: [],
      branding: { brandName: "BidWar" },
    });

    const first = await getHomepagePageData(loadFresh);
    expect(first.cacheHit).toBe(false);
    expect(first.data.branding).toEqual({ brandName: "BidWar" });
    expect(loadFresh).toHaveBeenCalledTimes(1);

    const second = await getHomepagePageData(loadFresh);
    expect(second.cacheHit).toBe(true);
    expect(loadFresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes after TTL expires", async () => {
    const loadFresh = vi
      .fn()
      .mockResolvedValueOnce({
        auctions: [],
        showcaseEvents: [],
        branding: { brandName: "A" },
      })
      .mockResolvedValueOnce({
        auctions: [],
        showcaseEvents: [],
        branding: { brandName: "B" },
      });

    await getHomepagePageData(loadFresh);
    vi.advanceTimersByTime(20_001);

    const refreshed = await getHomepagePageData(loadFresh);
    expect(refreshed.cacheHit).toBe(false);
    expect(refreshed.data.branding).toEqual({ brandName: "B" });
    expect(loadFresh).toHaveBeenCalledTimes(2);
  });

  it("invalidateHomepageCache forces a reload on next read", async () => {
    const loadFresh = vi
      .fn()
      .mockResolvedValueOnce({
        auctions: [],
        showcaseEvents: [],
        branding: { brandName: "A" },
      })
      .mockResolvedValueOnce({
        auctions: [],
        showcaseEvents: [],
        branding: { brandName: "B" },
      });

    await getHomepagePageData(loadFresh);
    invalidateHomepageCache();

    const afterInvalidate = await getHomepagePageData(loadFresh);
    expect(afterInvalidate.cacheHit).toBe(false);
    expect(afterInvalidate.data.branding).toEqual({ brandName: "B" });
    expect(loadFresh).toHaveBeenCalledTimes(2);
  });
});
