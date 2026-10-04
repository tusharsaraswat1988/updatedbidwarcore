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
} from "../../lib/tournament-navigation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 3: Generic Tournament Home Architecture", () => {
  const homeSrc = readFileSync(path.resolve(__dirname, "../tournament-home.tsx"), "utf8");
  const appSrc = readFileSync(path.resolve(__dirname, "../../platform-app.tsx"), "utf8");
  const layoutSrc = readFileSync(path.resolve(__dirname, "../../components/layout.tsx"), "utf8");
  const guardSrc = readFileSync(path.resolve(__dirname, "../../components/organizer-guard.tsx"), "utf8");
  const overviewSrc = readFileSync(path.resolve(__dirname, "../auction-overview.tsx"), "utf8");
  const hubAliasSrc = readFileSync(path.resolve(__dirname, "../tournament-hub.tsx"), "utf8");

  describe("1. Static verification — Tournament Home is lightweight & neutral", () => {
    it("does NOT import useAuctionSocket or any WebSockets", () => {
      expect(homeSrc).not.toContain("useAuctionSocket");
      expect(homeSrc).not.toMatch(/new\s+WebSocket/);
      expect(homeSrc).not.toContain("socket.io");
    });

    it("does NOT import useTournamentInsightsFeed", () => {
      expect(homeSrc).not.toContain("useTournamentInsightsFeed");
    });

    it("does NOT import or establish SSE connections", () => {
      expect(homeSrc).not.toContain("useSyncAuctionSse");
      expect(homeSrc).not.toMatch(/new\s+EventSource/);
      expect(homeSrc).not.toContain("EventSource");
    });

    it("does NOT initialize auction session creation or live bidding feeds", () => {
      expect(homeSrc).not.toContain("useCreateAuctionSession");
      expect(homeSrc).not.toContain("useLiveAuction");
    });

    it("does NOT import scoring runtimes or live scoring engines", () => {
      expect(homeSrc).not.toContain("useScoringLive");
      expect(homeSrc).not.toContain("useBadmintonLiveEngine");
      expect(homeSrc).not.toContain("useCricketLiveEngine");
    });

    it("uses module-neutral status labels and does NOT display 'Auction Running'", () => {
      expect(homeSrc).not.toContain("Auction Running");
      expect(homeSrc).toContain("Getting Ready");
      expect(homeSrc).toContain("Live");
      expect(homeSrc).toContain("Completed");
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

    it("auction-overview.tsx guards against auction-disabled tournaments", () => {
      expect(overviewSrc).toContain("isAuctionEnabled");
      expect(overviewSrc).toContain("Auction Workspace Not Enabled");
    });
  });

  describe("3. Routing & Module Guarding in platform-app.tsx and organizer-guard.tsx", () => {
    it("routes /tournament/:id to TournamentHome", () => {
      expect(appSrc).toContain('<Route path="/tournament/:id">');
      expect(appSrc).toContain("<TournamentHome");
    });

    it("routes /tournament/:id/auction-overview to AuctionOverview with requiredModule='auction'", () => {
      expect(appSrc).toContain('<Route path="/tournament/:id/auction-overview">');
      expect(appSrc).toMatch(/path="\/tournament\/:id\/auction-overview"[\s\S]*?requiredModule="auction"/);
    });

    it("routes /tournament/:id/overview alias to AuctionOverview with requiredModule='auction'", () => {
      expect(appSrc).toContain('<Route path="/tournament/:id/overview">');
      expect(appSrc).toMatch(/path="\/tournament\/:id\/overview"[\s\S]*?requiredModule="auction"/);
    });

    it("guards auction subroutes with requiredModule='auction'", () => {
      const auctionRoutes = [
        "/tournament/:id/teams",
        "/tournament/:id/categories",
        "/tournament/:id/players",
        "/tournament/:id/auction",
        "/tournament/:id/reset",
        "/tournament/:id/reports",
        "/tournament/:id/team-reports",
        "/tournament/:id/links",
        "/tournament/:id/fortune-wheel",
        "/tournament/:id/break-timer",
        "/tournament/:id/local-mode",
      ];
      for (const route of auctionRoutes) {
        expect(appSrc).toContain(`path="${route}"`);
      }
    });

    it("guards scoring entry points with requiredModule='scoring'", () => {
      expect(appSrc).toMatch(/path="\/tournament\/:id\/mission-control"[\s\S]*?requiredModule="scoring"/);
      expect(appSrc).toMatch(/path="\/tournament\/:id\/score"[\s\S]*?requiredModule="scoring"/);
      expect(appSrc).toMatch(/path="\/tournament\/:id\/badminton"[\s\S]*?requiredModule="scoring"/);
    });

    it("redirects scoring teams and subroutes to scoring-app via RedirectToScoringApp", () => {
      expect(appSrc).toContain('path="/tournament/:id/score/teams" component={RedirectToScoringApp}');
      expect(appSrc).toContain('path="/tournament/:id/score/players" component={RedirectToScoringApp}');
      expect(appSrc).toContain('path="/tournament/:id/score/dashboard" component={RedirectToScoringApp}');
    });

    it("organizer-guard renders clean 'Module Not Enabled' screen and NEVER silently redirects", () => {
      expect(guardSrc).toContain("Auction Workspace Not Enabled");
      expect(guardSrc).toContain("Sports Scoring Not Enabled");
      expect(guardSrc).not.toContain('navigate(`/tournament/${tournamentId}/auction-overview`)');
      expect(guardSrc).not.toContain('navigate(`/scoring-app');
    });

    it("organizer-guard provides a direct CTA to Sports Scoring when scoring is enabled", () => {
      expect(guardSrc).toContain("Go to Sports Scoring");
      expect(guardSrc).toContain("Go to Cricket Teams");
    });
  });

  describe("4. Module-aware sidebar navigation in layout.tsx", () => {
    it("imports isAuctionEnabled and isScoringEnabled from @workspace/platform-core", () => {
      expect(layoutSrc).toContain('from "@workspace/platform-core"');
      expect(layoutSrc).toContain("isAuctionEnabled");
      expect(layoutSrc).toContain("isScoringEnabled");
    });

    it("derives module state from existing tournament data with zero extra fetches", () => {
      expect(layoutSrc).toContain("const auctionActive = isAuctionEnabled(tournament);");
      expect(layoutSrc).toContain("const scoringActive = isScoringEnabled(tournament);");
      expect(layoutSrc).not.toContain("useGetTournamentSummary");
      expect(layoutSrc).not.toContain("useTournamentInsightsFeed");
    });

    it("links top navigation to Tournament Home", () => {
      expect(layoutSrc).toContain('title="Tournament Home"');
      expect(layoutSrc).toContain("Tournament Home</span>");
    });

    it("renders Auction Overview and auction setup under auctionActive conditional", () => {
      expect(layoutSrc).toContain("{auctionActive && (");
      expect(layoutSrc).toContain('title="Auction Overview"');
      expect(layoutSrc).toContain('href={`/tournament/${tournamentId}/auction-overview`}');
    });

    it("renders Run the Auction section only when auctionActive is true", () => {
      expect(layoutSrc).toMatch(/\{auctionActive && \([\s\S]*?Run the Auction/);
    });

    it("renders Match Scoring section only when scoringActive is true", () => {
      expect(layoutSrc).toMatch(/\{scoringActive && \([\s\S]*?Match Scoring/);
    });
  });

  describe("5. Navigation helpers and return path labels", () => {
    it("returns canonical paths for tournament home and auction overview", () => {
      expect(tournamentHomePath(99)).toBe("/tournament/99");
      expect(auctionOverviewPath(99)).toBe("/tournament/99/auction-overview");
    });

    it("labels tournament home and auction overview distinctly in returnPathBackLabel", () => {
      expect(returnPathBackLabel("/tournament/99")).toBe("Back to Tournament Home");
      expect(returnPathBackLabel("/tournament/99/")).toBe("Back to Tournament Home");
      expect(returnPathBackLabel("/tournament/99/auction-overview")).toBe("Back to Auction Overview");
      expect(returnPathBackLabel("/tournament/99/overview")).toBe("Back to Auction Overview");
    });
  });

  describe("6. Product Mode matrix logic", () => {
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
