import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BIDWAR — Licensing P1: Admin Tournament Detail Module Awareness", () => {
  const pageSrc = readFileSync(
    path.resolve(__dirname, "../admin-tournament-detail.tsx"),
    "utf8"
  );
  const authLibSrc = readFileSync(
    path.resolve(__dirname, "../../lib/auth.ts"),
    "utf8"
  );

  describe("1. Architectural Contract & Generic Headings", () => {
    it("preserves canonical heading 'Tournament Operations & Controls'", () => {
      expect(pageSrc).toContain("Tournament Operations & Controls");
    });

    it("documents dual-lifecycle decoupling transparently", () => {
      expect(pageSrc).toContain("Dual-Lifecycle Decoupling");
      expect(pageSrc).toContain("Concluding an auction does not conclude or lock match scoring");
    });
  });

  describe("2. Module-Aware Layout Gating (Auction-only vs Scoring-only vs Dual-module)", () => {
    it("computes productMode and defines module booleans isAuctionOnly, isScoringOnly, isDualModule", () => {
      expect(pageSrc).toContain("isAuctionOnly");
      expect(pageSrc).toContain("isScoringOnly");
      expect(pageSrc).toContain("isDualModule");
    });

    it("hides Base Purse and Bid Events in scoring-only mode", () => {
      // Base Purse and Bid Events are guarded behind !isScoringOnly
      expect(pageSrc).toContain("{!isScoringOnly && (");
      expect(pageSrc).toMatch(/{!isScoringOnly && \([\s\S]*?Base Purse[\s\S]*?Bid Events[\s\S]*?\)}/);
    });

    it("hides Bid Log and Live Auction Monitor tabs in scoring-only mode", () => {
      expect(pageSrc).toContain("{!isScoringOnly && (");
      expect(pageSrc).toMatch(/{!isScoringOnly && \([\s\S]*?DataTabLink id=\"bids\"/);
      expect(pageSrc).toMatch(/{!isScoringOnly && \([\s\S]*?LiveOpsTabLink[\s\S]*?section=\"monitor\"/);
    });

    it("renders match counts (total, live, completed, upcoming) when scoring is enabled", () => {
      expect(pageSrc).toContain("matchCounts.total");
      expect(pageSrc).toContain("matchCounts.live");
      expect(pageSrc).toContain("matchCounts.completed");
      expect(pageSrc).toContain("matchCounts.upcoming");
    });

    it("replaces Reset Auction Data with an informational notice in scoring-only mode", () => {
      expect(pageSrc).toContain("Auction Resets Inapplicable");
      expect(pageSrc).toContain("Auction module is disabled for this tournament");
    });
  });

  describe("3. Dual-Module Co-Equal Lifecycles", () => {
    it("renders co-equal lifecycles with independent state controls in dual-module mode", () => {
      expect(pageSrc).toContain("Dual-Module Lifecycles");
      expect(pageSrc).toContain("Auction Engine");
      expect(pageSrc).toContain("Sports Scoring Phase");
    });

    it("ensures concluding auction in dual-mode does NOT lock the tournament or conclude scoring", () => {
      expect(pageSrc).toContain("requestLicenseChange(\"End auction\", \"completed\", false)");
    });
  });

  describe("4. Sports Scoring Lifecycle & Phase Transitions", () => {
    it("provides phase buttons for Setup, Active/Live, and Completed", () => {
      expect(pageSrc).toContain("setPendingScoringPhase(\"setup\")");
      expect(pageSrc).toContain("setPendingScoringPhase(\"active\")");
      expect(pageSrc).toContain("setPendingScoringPhase(\"completed\")");
    });

    it("requires audit reason when transitioning scoring phase", () => {
      expect(pageSrc).toContain("AuditReasonDialog");
      expect(pageSrc).toContain("setTournamentScoringPhase");
    });
  });

  describe("5. Payment Verification & License Grant Flow", () => {
    it("defines verifyAndGrantTournamentLicense API client function in auth.ts", () => {
      expect(authLibSrc).toContain("export async function verifyAndGrantTournamentLicense");
      expect(authLibSrc).toContain("/auth/admin/tournaments/${tournamentId}/verify-and-grant-license");
    });

    it("renders license request & payment verification dialog with audit fields and passes reason", () => {
      expect(pageSrc).toContain("Verify Payment & Grant Live License");
      expect(pageSrc).toContain("verifyPaymentOpen");
      expect(pageSrc).toContain("verifyAndGrantTournamentLicense(tournamentId");
      expect(pageSrc).toContain("reason: paymentAuditReason.trim()");
    });

    it("communicates shared tournament license semantics transparently without claiming dual license columns", () => {
      expect(pageSrc).toContain("Tournament License Status");
      expect(pageSrc).toContain("Ending auction marks auction completed and preserves active sports scoring");
    });
  });

  describe("6. Quick Room & Display Launchers", () => {
    it("provides dedicated launcher links for cricket and badminton scoring hubs", () => {
      expect(pageSrc).toContain("/cricket/scorer?tid=${t.id}");
      expect(pageSrc).toContain("/tournament/${t.id}/score");
      expect(pageSrc).toContain("/badminton/scorer?tid=${t.id}");
      expect(pageSrc).toContain("/tournament/${t.id}/badminton");
    });
  });
});
