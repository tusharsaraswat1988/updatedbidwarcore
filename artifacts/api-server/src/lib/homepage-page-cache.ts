import type { DisplayAuctionRow } from "./display-auction-service.js";
import type { ShowcaseEventRow } from "./showcase-service.js";

/** Serializable homepage bundle — matches window.__BIDWAR_INITIAL_DATA__ contract. */
export type HomepagePageData = {
  auctions: DisplayAuctionRow[];
  showcaseEvents: ShowcaseEventRow[];
  branding: Record<string, unknown>;
  generatedAt: string;
};

export type HomepagePageDataResult = {
  data: HomepagePageData;
  cacheHit: boolean;
};

const TTL_MS = 20_000;

let cacheEntry: { data: HomepagePageData; expiresAt: number } | null = null;

export function invalidateHomepageCache(): void {
  cacheEntry = null;
}

export async function getHomepagePageData(
  loadFresh: () => Promise<Omit<HomepagePageData, "generatedAt">>,
): Promise<HomepagePageDataResult> {
  const now = Date.now();
  if (cacheEntry && now < cacheEntry.expiresAt) {
    return { data: cacheEntry.data, cacheHit: true };
  }

  const fresh = await loadFresh();
  const data: HomepagePageData = {
    ...fresh,
    generatedAt: new Date().toISOString(),
  };
  cacheEntry = { data, expiresAt: now + TTL_MS };
  return { data, cacheHit: false };
}

/** Test-only: reset module cache between tests. */
export function resetHomepageCacheForTests(): void {
  cacheEntry = null;
}
