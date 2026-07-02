import { brandingService } from "./branding-service.js";
import { displayAuctionService } from "./display-auction-service.js";
import { showcaseService } from "./showcase-service.js";
import {
  getHomepagePageData,
  invalidateHomepageCache,
  type HomepagePageData,
  type HomepagePageDataResult,
} from "./homepage-page-cache.js";

async function loadFreshHomepageData(): Promise<Omit<HomepagePageData, "generatedAt">> {
  const [auctions, showcaseEvents, branding] = await Promise.all([
    displayAuctionService.listForLanding(),
    showcaseService.listActive(),
    brandingService.getPublicBrandingPayload(),
  ]);
  return { auctions, showcaseEvents, branding };
}

export function invalidateHomepagePageCache(): void {
  invalidateHomepageCache();
}

export async function fetchHomepagePageData(): Promise<HomepagePageDataResult> {
  return getHomepagePageData(loadFreshHomepageData);
}

export type { HomepagePageData, HomepagePageDataResult };
