import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Cricket Teams Page Requirements", () => {
  const teamsPageSrc = readFileSync(
    path.resolve(__dirname, "../cricket/teams.tsx"),
    "utf8",
  );

  it("checks both auction and scoring enabled for Import from Auction button", () => {
    // Verified against both module flags
    expect(teamsPageSrc).toContain("isAuctionAndScoring");
    expect(teamsPageSrc).toContain("productMode === \"both\"");
    expect(teamsPageSrc).toContain("isAuctionEnabled(tournament)");
    expect(teamsPageSrc).toContain("isScoringEnabled(tournament)");
    // The button should be conditionally rendered
    expect(teamsPageSrc).toContain("{isAuctionAndScoring ? (");
    expect(teamsPageSrc).toContain("Import from Auction");
  });

  it("evaluates isAuctionAndScoring correctly for different module combinations", () => {
    // Scoring Only: auctionEnabled=false, scoringEnabled=true
    const scoringOnly = { auctionEnabled: false, scoringEnabled: true, productMode: "scoring_only" as const };
    const canImportScoringOnly = scoringOnly.productMode === "both" || (isAuctionEnabled(scoringOnly) && isScoringEnabled(scoringOnly));
    expect(canImportScoringOnly).toBe(false);

    // Both enabled: auctionEnabled=true, scoringEnabled=true
    const both = { auctionEnabled: true, scoringEnabled: true, productMode: "both" as const };
    const canImportBoth = both.productMode === "both" || (isAuctionEnabled(both) && isScoringEnabled(both));
    expect(canImportBoth).toBe(true);

    // Auction Only: auctionEnabled=true, scoringEnabled=false
    const auctionOnly = { auctionEnabled: true, scoringEnabled: false, productMode: "auction_only" as const };
    const canImportAuctionOnly = auctionOnly.productMode === "both" || (isAuctionEnabled(auctionOnly) && isScoringEnabled(auctionOnly));
    expect(canImportAuctionOnly).toBe(false);
  });

  it("includes registered teams count badge and stats ribbon at the top", () => {
    expect(teamsPageSrc).toContain("Total Registered:");
    expect(teamsPageSrc).toContain("badge=");
    expect(teamsPageSrc).toContain("Registered");
  });

  it("includes search, category, staff, and sort filters", () => {
    expect(teamsPageSrc).toContain("SearchInput");
    expect(teamsPageSrc).toContain("detectedCategories");
    expect(teamsPageSrc).toContain("categoryFilter");
    expect(teamsPageSrc).toContain("staffFilter");
    expect(teamsPageSrc).toContain("sortBy");
    expect(teamsPageSrc).toContain("clearFilters");
  });
});
