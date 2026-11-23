import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { downloadAuctionRulesPdf } from "../../lib/auction-rules-download";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Auction Overview Rules PDF & Pre-Auction Report Placement", () => {
  const overviewSrc = readFileSync(path.resolve(__dirname, "../auction-overview.tsx"), "utf8");
  const layoutSrc = readFileSync(path.resolve(__dirname, "../../components/layout.tsx"), "utf8");
  const reportsSrc = readFileSync(path.resolve(__dirname, "../reports.tsx"), "utf8");
  const portalSrc = readFileSync(path.resolve(__dirname, "../organizer-portal.tsx"), "utf8");

  describe("1. Auction Overview Page Actions", () => {
    it("renders Pre-Auction Report button during setup phase", () => {
      expect(overviewSrc).toContain("Pre-Auction Report");
      expect(overviewSrc).toContain("navigate(`/tournament/${tournamentId}/reports`)");
    });

    it("renders Download Rules PDF in the quick action bar", () => {
      expect(overviewSrc).toContain("Download Rules PDF");
      expect(overviewSrc).toContain("handleDownloadAuctionRules");
      expect(overviewSrc).toContain("downloadAuctionRulesPdf");
    });

    it("renders Download Rules PDF inside the Auction Rules & Timers section header", () => {
      expect(overviewSrc).toMatch(/Auction Rules &amp; Timers[\s\S]*?Download Rules PDF[\s\S]*?Configure Rules →/);
    });

    it("renders standard Reports button when auction is active", () => {
      expect(overviewSrc).toMatch(/tournament\?\.status === "active"[\s\S]*?<BarChart3 className="w-3\.5 h-3\.5 text-primary" \/>\s*Reports/);
    });
  });

  describe("2. Navigation Shell & Sidebar Intelligence", () => {
    it("intelligently labels sidebar report link as Pre-Auction Report during setup", () => {
      expect(layoutSrc).toContain('const isPreAuction = tournament?.status === "setup";');
      expect(layoutSrc).toContain('const reportsTitle = isPreAuction ? "Pre-Auction Report" : "Reports";');
      expect(layoutSrc).toContain('title={reportsTitle}');
      expect(layoutSrc).toContain('{expanded && <span className="font-medium">{reportsTitle}</span>}');
    });
  });

  describe("3. Reports & Document Center Page", () => {
    it("adapts title and description when tournament is in pre-auction setup", () => {
      expect(reportsSrc).toContain('isPreAuction ? "Pre-Auction Reports & Document Center" : "Reports & Document Center"');
      expect(reportsSrc).toContain("Pre-auction intelligence, squad planning worksheets, player catalogue, and official exports.");
    });

    it("defaults initialReport to team planning sheet during pre-auction setup", () => {
      expect(reportsSrc).toContain("openPlanningSheet || isPreAuction ? TEAM_PLANNING_SHEET_ID : null");
    });
  });

  describe("4. Organizer Portal Integration", () => {
    it("uses downloadAuctionRulesPdf in organizer portal with proper feedback", () => {
      expect(portalSrc).toContain("downloadAuctionRulesPdf");
      expect(portalSrc).not.toContain("disabled={isLocked || !t.auctionRulesPdfReady || downloadingRulesTid === t.id}");
    });
  });

  describe("5. Auction Rules Download Gate Utility", () => {
    it("returns error message when tournament rules are incomplete", async () => {
      const incompleteTournament = {
        id: 43,
        name: "Diamonds Premier League",
        city: "", // Missing city
        basePurse: 0,
        minBid: 0,
      };

      const result = await downloadAuctionRulesPdf(incompleteTournament as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
