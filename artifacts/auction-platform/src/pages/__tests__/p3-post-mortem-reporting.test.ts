import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("P3 Automated Post-Auction Intelligence Reporting & Moneyball Index UI", () => {
  const debriefComponentSrc = readFileSync(
    path.resolve(__dirname, "../../components/reports/post-mortem-debrief.tsx"),
    "utf8"
  );
  const reportsPageSrc = readFileSync(
    path.resolve(__dirname, "../reports.tsx"),
    "utf8"
  );
  const overviewPageSrc = readFileSync(
    path.resolve(__dirname, "../auction-overview.tsx"),
    "utf8"
  );

  describe("1. PostMortemDebrief Component (post-mortem-debrief.tsx)", () => {
    it("defines PostMortemDebrief with post-mortem-debrief container test ID", () => {
      expect(debriefComponentSrc).toContain("export function PostMortemDebrief(");
      expect(debriefComponentSrc).toContain('data-testid="post-mortem-debrief"');
      expect(debriefComponentSrc).toContain("Moneyball Squad Efficiency Index & Market Overview");
    });

    it("fetches post-mortem intelligence endpoint with dual path fallback", () => {
      expect(debriefComponentSrc).toContain("/api/intelligence/post-mortem/");
      expect(debriefComponentSrc).toContain("/api/tournaments/");
      expect(debriefComponentSrc).toContain("/intelligence/post-mortem");
    });

    it("renders Market Overview KPI strip for Turnover, Inflation, Clearance Rate, and Avg Cost", () => {
      expect(debriefComponentSrc).toContain("Total Market Turnover");
      expect(debriefComponentSrc).toContain("Average Inflation");
      expect(debriefComponentSrc).toContain("Clearance Rate");
      expect(debriefComponentSrc).toContain("Market Cost / Player");
      expect(debriefComponentSrc).toContain("marketOverview.totalTurnover");
      expect(debriefComponentSrc).toContain("marketOverview.averageInflationPct");
      expect(debriefComponentSrc).toContain("marketOverview.soldRatio");
      expect(debriefComponentSrc).toContain("marketOverview.tournamentAvgCostPerPlayer");
    });

    it("renders Moneyball Squad Efficiency leaderboard with ranks, squad progress, and 0-100 scores", () => {
      expect(debriefComponentSrc).toContain('data-testid="moneyball-leaderboard"');
      expect(debriefComponentSrc).toContain("Squad Progress");
      expect(debriefComponentSrc).toContain("Purse Spent");
      expect(debriefComponentSrc).toContain("Cost / Player");
      expect(debriefComponentSrc).toContain("Budget Deployed");
      expect(debriefComponentSrc).toContain("Moneyball Score");
      expect(debriefComponentSrc).toContain("team.efficiencyScore");
      expect(debriefComponentSrc).toContain("team.rank");
      expect(debriefComponentSrc).toContain("team.squadCompletionRate");
      expect(debriefComponentSrc).toContain("team.budgetDeploymentRate");
    });

    it("provides 1-click Download Report button with CSV, PDF, and JSON export support", () => {
      expect(debriefComponentSrc).toContain('data-testid="download-report-btn"');
      expect(debriefComponentSrc).toContain("Download Report (CSV)");
      expect(debriefComponentSrc).toContain("/api/intelligence/post-mortem/${tournamentId}/export?format=");
      expect(debriefComponentSrc).toContain('handleDownload("csv")');
      expect(debriefComponentSrc).toContain('handleDownload("pdf")');
    });

    it("renders Marquee Steals and Record Breaker Duels with price multipliers and bid counts", () => {
      expect(debriefComponentSrc).toContain("Top 5 Bargain Steals (Lowest Multiplier with High Bids)");
      expect(debriefComponentSrc).toContain("Top 5 Record Breakers & Fiercest Bidding Wars");
      expect(debriefComponentSrc).toContain("highlights.topBargainSteals");
      expect(debriefComponentSrc).toContain("highlights.topRecordBreakers");
      expect(debriefComponentSrc).toContain("b.multiplier");
      expect(debriefComponentSrc).toContain("w.inflationPct");
      expect(debriefComponentSrc).toContain("w.totalBids");
    });

    it("renders category breakdown and unsold summary with unallocated reserve value", () => {
      expect(debriefComponentSrc).toContain("Category Spend & Inflation Dynamics");
      expect(debriefComponentSrc).toContain("Unsold Lots by Category");
      expect(debriefComponentSrc).toContain("Unallocated Reserve Value:");
      expect(debriefComponentSrc).toContain("highlights.unsoldByCategory");
    });
  });

  describe("2. Reports & Document Center Page Integration (reports.tsx)", () => {
    it("imports and mounts PostMortemDebrief for post-auction intelligence review", () => {
      expect(reportsPageSrc).toContain('import { PostMortemDebrief } from "@/components/reports/post-mortem-debrief";');
      expect(reportsPageSrc).toContain("<PostMortemDebrief tournamentId={tournamentId} />");
      expect(reportsPageSrc).toContain("!isPreAuction");
    });
  });

  describe("3. Auction Overview Page Integration (auction-overview.tsx)", () => {
    it("provides quick action button navigating to Post-Auction Debrief & Moneyball Index", () => {
      expect(overviewPageSrc).toContain("Post-Auction Debrief &amp; Moneyball");
      expect(overviewPageSrc).toContain("/reports?tab=moneyball");
    });

    it("embeds PostMortemDebrief when tournament status is completed", () => {
      expect(overviewPageSrc).toContain('import { PostMortemDebrief } from "@/components/reports/post-mortem-debrief";');
      expect(overviewPageSrc).toContain('tournament?.status === "completed"');
      expect(overviewPageSrc).toContain("<PostMortemDebrief tournamentId={tournamentId} />");
    });
  });
});
