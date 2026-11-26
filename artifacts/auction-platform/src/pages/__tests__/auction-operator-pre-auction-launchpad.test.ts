import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Auction Operator Pre-Auction Launchpad UX Overhaul", () => {
  const operatorSrc = readFileSync(path.resolve(__dirname, "../auction-operator.tsx"), "utf8");

  describe("1. Pre-Auction Lifecycle State Definition", () => {
    it("defines isPreAuction as strictly when auction is not active, not paused, and not completed", () => {
      expect(operatorSrc).toContain("const isPreAuction = !isActive && !isPaused && !isCompleted;");
    });

    it("evaluates pre-flight readiness issues proactively during pre-auction stage", () => {
      expect(operatorSrc).toContain("const preAuctionReadinessIssues = useMemo(");
      expect(operatorSrc).toContain("validateAuctionReadiness(input, isTrialMode ? \"trial\" : \"live\")");
    });
  });

  describe("2. Center Stage: Intelligent Pre-Auction Launchpad", () => {
    it("contains preAuctionLaunchpad component block with hero heading and status badge", () => {
      expect(operatorSrc).toContain("const preAuctionLaunchpad = (");
      expect(operatorSrc).toContain("Pre-Auction Stage · Ready to Launch");
      expect(operatorSrc).toContain("Ready to Start the Auction?");
    });

    it("displays pre-flight operational vitals (teams, player pool, draw mode, owner bidding)", () => {
      expect(operatorSrc).toContain("Teams");
      expect(operatorSrc).toContain("Player Pool");
      expect(operatorSrc).toContain("Draw Mode");
      expect(operatorSrc).toContain("Owner Bidding");
    });

    it("prominently renders the START LIVE AUCTION hero call-to-action button", () => {
      expect(operatorSrc).toContain("START LIVE AUCTION");
      expect(operatorSrc).toContain("Press <kbd");
      expect(operatorSrc).toContain("Enter");
    });

    it("provides review checklist link with real-time issue count if rules are missing", () => {
      expect(operatorSrc).toContain("preAuctionReadinessIssues.length");
      expect(operatorSrc).toContain("Review checklist →");
      expect(operatorSrc).toContain("All pre-flight rules validated");
    });
  });

  describe("3. Desktop & Mobile Workspace Composition", () => {
    it("replaces dead disabled bidding cards on desktop center main with preAuctionLaunchpad when in pre-auction", () => {
      expect(operatorSrc).toContain("{isPreAuction ? (");
      expect(operatorSrc).toContain("{preAuctionLaunchpad}");
    });

    it("synchronizes the top toolbar button with pre-auction launch status", () => {
      expect(operatorSrc).toContain("Start Live Auction");
    });

    it("supports keyboard Enter key to launch the live auction in pre-auction mode", () => {
      expect(operatorSrc).toMatch(/case\s+"enter":[\s\S]*isPreAuction[\s\S]*handleStartAuction\(\);/);
    });
  });

  describe("4. Readiness Dialog Positive Reassurance", () => {
    it("displays All Pre-Flight Checks Passed when there are zero issues", () => {
      expect(operatorSrc).toContain("All Pre-Flight Checks Passed");
      expect(operatorSrc).toContain("Pre-Flight Readiness Checklist");
    });
  });
});
