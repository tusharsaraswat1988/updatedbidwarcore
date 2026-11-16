import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 3: BidWar Unified Fan Page Child Renderers Integration", () => {
  const fanDir = path.resolve(__dirname, "..");
  const pagesDir = path.resolve(__dirname, "../../../pages");

  const unifiedFanPageSrc = fs.readFileSync(path.join(pagesDir, "unified-fan-page.tsx"), "utf8");
  const liveViewerSrc = fs.readFileSync(path.join(pagesDir, "liveviewer.tsx"), "utf8");
  const scoringPublicSrc = fs.readFileSync(path.join(pagesDir, "scoring-public.tsx"), "utf8");
  const auctionRendererSrc = fs.readFileSync(path.join(fanDir, "auction-fan-renderer.tsx"), "utf8");
  const cricketRendererSrc = fs.readFileSync(path.join(fanDir, "cricket-fan-renderer.tsx"), "utf8");
  const badmintonRendererSrc = fs.readFileSync(path.join(fanDir, "badminton-fan-renderer.tsx"), "utf8");

  describe("1. Auction Renderer Integration", () => {
    it("extracts and renders LiveViewerPage in embedded spectator mode", () => {
      expect(auctionRendererSrc).toContain('import LiveViewerPage from "@/pages/liveviewer";');
      expect(auctionRendererSrc).toContain("<LiveViewerPage tournamentId={tournamentId} embedded={true} />");
      expect(liveViewerSrc).toContain("export interface LiveViewerPageProps");
      expect(liveViewerSrc).toContain("embedded = false");
    });

    it("preserves auction countdown, bidding presentation, and sound engine", () => {
      expect(liveViewerSrc).toContain("useAuctionSocket");
      expect(liveViewerSrc).toContain("useSoundEngine");
      expect(liveViewerSrc).toContain("OutcomeResultPanel");
      expect(liveViewerSrc).toContain("BreakCountdownOverlay");
      expect(liveViewerSrc).toContain("SponsorTicker");
    });

    it("does not lock document body overflow when embedded in unified fan page", () => {
      expect(liveViewerSrc).toContain("if (embedded) return;");
      expect(liveViewerSrc).toContain('html.style.overflow = "hidden";');
    });
  });

  describe("2. Cricket Scoring Renderer Integration", () => {
    it("extracts and renders ScoringPublicPage in embedded spectator mode", () => {
      expect(cricketRendererSrc).toContain('import ScoringPublicPage from "@/pages/scoring-public";');
      expect(cricketRendererSrc).toContain("<ScoringPublicPage tournamentIdProp={tournamentId} embedded={true} />");
      expect(scoringPublicSrc).toContain("export interface ScoringPublicPageProps");
      expect(scoringPublicSrc).toContain("embedded = false");
    });

    it("preserves cricket scoreboard, match cards, standings, and fan arena", () => {
      expect(scoringPublicSrc).toContain("LiveMiniScoreboard");
      expect(scoringPublicSrc).toContain("PublicMatchCard");
      expect(scoringPublicSrc).toContain("StandingsTable");
      expect(scoringPublicSrc).toContain("LeaderboardTable");
      expect(scoringPublicSrc).toContain("FanArenaSection");
      expect(scoringPublicSrc).toContain("FanCheerFloatingWidget");
    });
  });

  describe("3. Badminton Scoring Renderer Integration", () => {
    it("subscribes to badminton dashboard realtime stream and cleans up on unmount", () => {
      expect(badmintonRendererSrc).toContain("subscribeBadmintonDashboardStream(");
      expect(badmintonRendererSrc).toContain("tournamentId");
      expect(badmintonRendererSrc).toContain("return () => {");
      expect(badmintonRendererSrc).toContain("unsub();");
    });

    it("incorporates multi-court tracking, category points table, and completed results", () => {
      expect(badmintonRendererSrc).toContain("fetchBadmintonMatches");
      expect(badmintonRendererSrc).toContain("useBadmintonLeaderboardBoards");
      expect(badmintonRendererSrc).toContain("MatchPointsSummary");
      expect(badmintonRendererSrc).toContain("listLiveMatches");
      expect(badmintonRendererSrc).toContain("listRecentCompleted");
    });
  });

  describe("4. Module Lifecycle & Realtime Isolation", () => {
    it("conditionally mounts only the active module renderer in UnifiedFanPage", () => {
      expect(unifiedFanPageSrc).toContain('{activeTab === "auction" && showAuctionTab && (');
      expect(unifiedFanPageSrc).toContain("<AuctionFanRenderer tournamentId={tournamentId} />");
      expect(unifiedFanPageSrc).toContain('{activeTab === "scoring" && showScoringTab && sport === "cricket" && (');
      expect(unifiedFanPageSrc).toContain("<CricketFanRenderer tournamentId={tournamentId} />");
      expect(unifiedFanPageSrc).toContain('{activeTab === "scoring" && showScoringTab && sport === "badminton" && (');
      expect(unifiedFanPageSrc).toContain("<BadmintonFanRenderer tournamentId={tournamentId} />");
    });

    it("guarantees inactive tab renderers are unmounted so SSE and polling suspend", () => {
      // In React JSX, ternary or boolean condition {activeTab === "auction" && ...} strictly unmounts
      // when activeTab switches, invoking cleanup effects for EventSource subscriptions.
      expect(unifiedFanPageSrc).not.toContain('style={{ display: activeTab === "auction" ? "block" : "none" }}');
    });
  });

  describe("5. Fallback for Unsupported Sports", () => {
    it("renders UnsupportedSportFallback gracefully without crashing the shell", () => {
      expect(unifiedFanPageSrc).toContain('sport !== "cricket" && sport !== "badminton" && (');
      expect(unifiedFanPageSrc).toContain("<UnsupportedSportFallback sport={sport} tournamentName={tournament.name} />");
      expect(unifiedFanPageSrc).toContain("export function UnsupportedSportFallback");
    });
  });

  describe("6. Legacy Routes Backward Compatibility", () => {
    it("preserves standalone default exports for /live/:id and /fan/:id routes", () => {
      expect(liveViewerSrc).toContain("export default function LiveViewerPage");
      expect(scoringPublicSrc).toContain("export default function ScoringPublicPage");
    });
  });
});
