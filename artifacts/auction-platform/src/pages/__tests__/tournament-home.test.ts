import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
} from "@workspace/platform-core";
import {
  auctionOverviewPath,
  tournamentHomePath,
  returnPathBackLabel,
  resolveTournamentOrganizerLandingPath,
} from "../../lib/tournament-navigation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 3: Auction module landing & compatibility routes", () => {
  const homeSrc = readFileSync(path.resolve(__dirname, "../tournament-home.tsx"), "utf8");
  const appSrc = readFileSync(path.resolve(__dirname, "../../platform-app.tsx"), "utf8");
  const layoutSrc = readFileSync(path.resolve(__dirname, "../../components/layout.tsx"), "utf8");
  const guardSrc = readFileSync(path.resolve(__dirname, "../../components/organizer-guard.tsx"), "utf8");
  const overviewSrc = readFileSync(path.resolve(__dirname, "../auction-overview.tsx"), "utf8");
  const hubAliasSrc = readFileSync(path.resolve(__dirname, "../tournament-hub.tsx"), "utf8");
  const portalSrc = readFileSync(path.resolve(__dirname, "../organizer-portal.tsx"), "utf8");
  const contextSrc = readFileSync(
    path.resolve(__dirname, "../../components/current-tournament-context.tsx"),
    "utf8",
  );

  describe("1. `/tournament/:id` compatibility redirect (no standalone home page)", () => {
    it("redirects via resolveTournamentOrganizerLandingPath with replace navigation", () => {
      expect(homeSrc).toContain("resolveTournamentOrganizerLandingPath");
      expect(homeSrc).toContain('navigate(target, { replace: true })');
      expect(homeSrc).toContain('data-testid="tournament-root-redirect"');
    });

    it("does NOT host auction/scoring runtimes on the compatibility route", () => {
      expect(homeSrc).not.toContain("useAuctionSocket");
      expect(homeSrc).not.toContain("useTournamentInsightsFeed");
      expect(homeSrc).not.toContain("Available Workspaces");
    });
  });

  describe("2. Single Auction Overview implementation & aliasing", () => {
    it("tournament-hub.tsx re-exports AuctionOverview without code duplication", () => {
      expect(hubAliasSrc).toContain('export { default } from "./auction-overview";');
    });

    it("auction-overview.tsx preserves auction readiness and insights feed", () => {
      expect(overviewSrc).toContain("useTournamentInsightsFeed");
      expect(overviewSrc).toContain("useGetTournamentSummary");
      expect(overviewSrc).toContain("useGetTeamPurses");
    });

    it("auction-overview.tsx does not link back to legacy Tournament Home", () => {
      expect(overviewSrc).not.toContain("Return to Tournament Home");
      expect(overviewSrc).not.toContain("Go to Tournament Home");
    });
  });

  describe("3. Routing & Module Guarding in platform-app.tsx and organizer-guard.tsx", () => {
    it("routes /tournament/:id to compatibility redirect component", () => {
      expect(appSrc).toContain('<Route path="/tournament/:id">');
      expect(appSrc).toContain("<TournamentHome");
    });

    it("routes /tournament/:id/auction-overview to AuctionOverview with requiredModule='auction'", () => {
      expect(appSrc).toContain('<Route path="/tournament/:id/auction-overview">');
      expect(appSrc).toMatch(/path="\/tournament\/:id\/auction-overview"[\s\S]*?requiredModule="auction"/);
    });

    it("organizer-guard does not send users to legacy Tournament Home", () => {
      expect(guardSrc).not.toContain("Go to Tournament Home");
      expect(guardSrc).toContain("Go to Auction Overview");
    });

    it("guards scoring entry points with requiredModule='scoring'", () => {
      expect(appSrc).toMatch(/path="\/tournament\/:id\/mission-control"[\s\S]*?requiredModule="scoring"/);
      expect(appSrc).toMatch(/path="\/tournament\/:id\/score"[\s\S]*?requiredModule="scoring"/);
      expect(appSrc).toMatch(/path="\/tournament\/:id\/badminton"[\s\S]*?requiredModule="scoring"/);
    });
  });

  describe("4. Auction sidebar — no Tournament Home or scoring group in auction shell", () => {
    it("does NOT render Tournament Home in the auction sidebar", () => {
      expect(layoutSrc).not.toContain('title="Tournament Home"');
      expect(layoutSrc).not.toContain("Tournament Home</span>");
    });

    it("lists Auction Overview first under Setup when auction is active", () => {
      expect(layoutSrc).toContain('title="Auction Overview"');
      expect(layoutSrc).toContain('href={`/tournament/${tournamentId}/auction-overview`}');
    });

    it("hides Match Scoring nav when auction module is active (scoring-only sidebar remains)", () => {
      expect(layoutSrc).toMatch(/\{scoringActive && !auctionActive && \(/);
    });

    it("Current Tournament chip links to module landing href, not legacy root", () => {
      expect(contextSrc).toContain("overviewHref");
      expect(contextSrc).not.toMatch(/overviewHref = `\/tournament\/\$\{tournamentId\}`/);
    });
  });

  describe("5. All Tournaments auction entry", () => {
    it("Enter/View Auction navigates to Auction Overview", () => {
      expect(portalSrc).toContain("navigate(auctionOverviewPath(t.id))");
      expect(portalSrc).toContain("Enter Auction");
    });
  });

  describe("6. Navigation helpers", () => {
    it("returns canonical paths for compatibility root and auction overview", () => {
      expect(tournamentHomePath(99)).toBe("/tournament/99");
      expect(auctionOverviewPath(99)).toBe("/tournament/99/auction-overview");
      expect(
        resolveTournamentOrganizerLandingPath(99, { auctionEnabled: true, scoringEnabled: false }),
      ).toBe("/tournament/99/auction-overview");
    });

    it("labels legacy root paths as Auction Overview in returnPathBackLabel", () => {
      expect(returnPathBackLabel("/tournament/99/auction-overview")).toBe("Back to Auction Overview");
      expect(returnPathBackLabel("/tournament/99")).toBe("Back to Auction Overview");
    });
  });

  describe("7. Product Mode matrix logic", () => {
    it("auction_only: auctionEnabled=true, scoringEnabled=false", () => {
      const t = { auctionEnabled: true, scoringEnabled: false };
      expect(isAuctionEnabled(t)).toBe(true);
      expect(isScoringEnabled(t)).toBe(false);
      expect(resolveTournamentProductMode(t)).toBe("auction_only");
    });

    it("scoring_only: auctionEnabled=false, scoringEnabled=true", () => {
      const t = { auctionEnabled: false, scoringEnabled: true };
      expect(isAuctionEnabled(t)).toBe(false);
      expect(isScoringEnabled(t)).toBe(true);
      expect(resolveTournamentProductMode(t)).toBe("scoring_only");
    });

    it("both: auctionEnabled=true, scoringEnabled=true", () => {
      const t = { auctionEnabled: true, scoringEnabled: true };
      expect(isAuctionEnabled(t)).toBe(true);
      expect(isScoringEnabled(t)).toBe(true);
      expect(resolveTournamentProductMode(t)).toBe("both");
    });
  });
});
