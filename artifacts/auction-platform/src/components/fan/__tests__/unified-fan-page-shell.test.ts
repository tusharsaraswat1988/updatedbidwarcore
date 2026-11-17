import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
  isScoringSupportedSport,
} from "@workspace/platform-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 2: BidWar Unified Fan Page Shell & Adaptive Module Navigation", () => {
  const platformAppSrc = readFileSync(path.resolve(__dirname, "../../../platform-app.tsx"), "utf8");
  const unifiedFanPageSrc = readFileSync(path.resolve(__dirname, "../../../pages/unified-fan-page.tsx"), "utf8");
  const shellSrc = readFileSync(path.resolve(__dirname, "../unified-fan-page-shell.tsx"), "utf8");
  const navSrc = readFileSync(path.resolve(__dirname, "../unified-module-nav.tsx"), "utf8");

  describe("1. Canonical Route Registration", () => {
    it("registers /tournament/:id/fan mapped to UnifiedFanPage in platform-app.tsx", () => {
      expect(platformAppSrc).toContain('const UnifiedFanPage = lazyWithRetry(() => import("@/pages/unified-fan-page"));');
      expect(platformAppSrc).toContain('<Route path="/tournament/:id/fan"');
      expect(platformAppSrc).toContain('UnifiedFanPage');
    });

    it("does not remove or break legacy redirect routes in platform-app.tsx", () => {
      expect(platformAppSrc).toContain('<Route path="/live/:id" component={LiveViewer} />');
      expect(platformAppSrc).toContain('<Route path="/:code/fanpage" component={RedirectToScoringApp} />');
      expect(platformAppSrc).toContain('<Route path="/fan/:id" component={RedirectToScoringApp} />');
    });
  });

  describe("2. Product Mode Resolution Logic", () => {
    it("derives auction_only when auction is enabled and scoring is disabled", () => {
      const mode = resolveTournamentProductMode({ auctionEnabled: true, scoringEnabled: false });
      expect(mode).toBe("auction_only");
    });

    it("derives scoring_only when auction is disabled and scoring is enabled", () => {
      const mode = resolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: true });
      expect(mode).toBe("scoring_only");
    });

    it("derives both when auction and scoring are both enabled", () => {
      const mode = resolveTournamentProductMode({ auctionEnabled: true, scoringEnabled: true });
      expect(mode).toBe("both");
    });

    it("supports cricket and badminton as verified scoring sports", () => {
      expect(isScoringSupportedSport("cricket")).toBe(true);
      expect(isScoringSupportedSport("badminton")).toBe(true);
      expect(isScoringSupportedSport("football")).toBe(false);
      expect(isScoringSupportedSport("kabaddi")).toBe(false);
    });
  });

  describe("3. Unified Module Navigation Component Contract", () => {
    it("contains accessible tablist, tabs, and aria-selected attributes", () => {
      expect(navSrc).toContain('role="tablist"');
      expect(navSrc).toContain('role="tab"');
      expect(navSrc).toContain('aria-selected={activeTab === "auction"}');
      expect(navSrc).toContain('aria-selected={activeTab === "scoring"}');
      expect(navSrc).toContain('id="fan-tab-auction"');
      expect(navSrc).toContain('id="fan-tab-scoring"');
    });

    it("suppresses navigation pills when tournament is single-module (auction_only or scoring_only)", () => {
      expect(navSrc).toContain("if (!showAuctionTab || !showScoringTab) {");
      expect(navSrc).toContain("return null;");
    });

    it("renders live beacons when isAuctionLive or isScoringLive are active", () => {
      expect(navSrc).toContain("isAuctionLive ? (");
      expect(navSrc).toContain("isScoringLive ? (");
      expect(navSrc).toContain("LIVE");
    });
  });

  describe("4. Unified Fan Page Shell UI & Layout Contract", () => {
    it("renders tournament header with branding, share dialog, and audio controls", () => {
      expect(shellSrc).toContain("FanArenaShell");
      expect(shellSrc).toContain("onToggleSound");
    });

    it("exports loading skeleton and error state components", () => {
      expect(shellSrc).toContain("export function UnifiedFanPageLoadingSkeleton");
      expect(shellSrc).toContain("export function UnifiedFanPageErrorState");
    });

    it("uses dark spectator background and data surface attribute", () => {
      expect(shellSrc).toContain('data-surface="unified-fan-page"');
    });
  });

  describe("5. Unified Fan Page URL Tab State Synchronization", () => {
    it("reads ?tab= from window.location.search and updates state without full page reload", () => {
      expect(unifiedFanPageSrc).toContain('urlParams.get("tab")');
      expect(unifiedFanPageSrc).toContain('window.history.pushState({ tab: nextTab }, "", url.toString());');
      expect(unifiedFanPageSrc).toContain("localStorage.setItem(`bidwar_fan_pref_${tournamentId}`, nextTab);");
    });

    it("listens to window popstate to support browser Back and Forward navigation", () => {
      expect(unifiedFanPageSrc).toContain('window.addEventListener("popstate", handlePopState);');
      expect(unifiedFanPageSrc).toContain('window.removeEventListener("popstate", handlePopState);');
    });

    it("handles 8-character tournament codes via context resolution query", () => {
      expect(unifiedFanPageSrc).toContain("fetch(`/api/register/${encodeURIComponent(rawIdentifier)}/context`)");
    });
  });

  describe("6. Strict Domain Boundary Integrity", () => {
    it("does not prematurely import auction bidding actions or scoring engines into Phase 2 shell", () => {
      expect(unifiedFanPageSrc).not.toContain("useAuctionSocket");
      expect(unifiedFanPageSrc).not.toContain("useScoringSocket");
      expect(unifiedFanPageSrc).not.toContain("executeBid");
      expect(unifiedFanPageSrc).not.toContain("recordBall");
      expect(unifiedFanPageSrc).not.toContain("submitPoint");
    });
  });
});
