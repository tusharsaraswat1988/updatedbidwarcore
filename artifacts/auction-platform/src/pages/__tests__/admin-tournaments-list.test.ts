import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BIDWAR — Admin Tournaments List Separation & Governance", () => {
  const pageSrc = readFileSync(
    path.resolve(__dirname, "../admin-tournaments-list.tsx"),
    "utf8"
  );
  const authLibSrc = readFileSync(
    path.resolve(__dirname, "../../lib/auth.ts"),
    "utf8"
  );
  const authRouteSrc = readFileSync(
    path.resolve(__dirname, "../../../../api-server/src/routes/auth.ts"),
    "utf8"
  );

  describe("1. Distinct Filter Groups (Tournament Status vs License Status)", () => {
    it("defines separate types for tournamentStatusFilter and licenseStatusFilter", () => {
      expect(pageSrc).toContain("type TournamentStatusFilter");
      expect(pageSrc).toContain("type LicenseStatusFilter");
      expect(pageSrc).not.toContain('type FilterStatus = "all" | "active" | "trial" | "completed" | "locked"');
    });

    it("renders separate filter button bars for Tournament Status and License Status", () => {
      expect(pageSrc).toContain("Tournament:");
      expect(pageSrc).toContain("License:");
      expect(pageSrc).toContain("tournamentCounts");
      expect(pageSrc).toContain("licenseCounts");
    });

    it("includes independent active states and counts for both dimensions", () => {
      expect(pageSrc).toContain("setTournamentStatusFilter");
      expect(pageSrc).toContain("setLicenseStatusFilter");
      expect(pageSrc).toContain("All Licenses");
      expect(pageSrc).toContain("Live License");
    });
  });

  describe("2. Terminology Correction (Live License instead of Production)", () => {
    it("renders 'Live License' instead of 'Production' in LicenseTierBadge", () => {
      expect(pageSrc).toContain("Live License");
      expect(pageSrc).not.toMatch(/>\s*Production\s*</);
    });

    it("uses 'Live License' in filter buttons and direct grant actions", () => {
      expect(pageSrc).toContain("Live License ({licenseCounts.active})");
      expect(pageSrc).toContain("Grant Live License");
    });
  });

  describe("3. Column Layout & Required Fields", () => {
    it("defines separate columns for Tournament, Sport, Code, Organiser, Schedule, Status, License, and Action", () => {
      expect(pageSrc).toContain('{ label: "Tournament" }');
      expect(pageSrc).toContain('{ label: "Sport" }');
      expect(pageSrc).toContain('{ label: "Code" }');
      expect(pageSrc).toContain('{ label: "Organiser" }');
      expect(pageSrc).toContain('{ label: "Schedule" }');
      expect(pageSrc).toContain('{ label: "Status" }');
      expect(pageSrc).toContain('{ label: "License" }');
      expect(pageSrc).toContain('{ label: "Action", align: "right" }');
    });

    it("does not render ID # number subtitle under the tournament name", () => {
      expect(pageSrc).not.toContain("ID #{t.id}");
      expect(pageSrc).not.toContain("<span>ID #{t.id}</span>");
    });

    it("renders tournament / auction code with copy to clipboard functionality", () => {
      expect(pageSrc).toContain("t.auctionCode");
      expect(pageSrc).toContain("handleCopyCode");
    });
  });

  describe("4. Direct License Grant Action & Dialog", () => {
    it("renders a direct Grant License button for trial tournaments", () => {
      expect(pageSrc).toContain("Grant License");
      expect(pageSrc).toContain("setGrantTarget(t)");
    });

    it("provides audit reason presets for immediate super admin activation", () => {
      expect(pageSrc).toContain("AUDIT_REASON_PRESETS");
      expect(pageSrc).toContain("Payment verified in bank statement");
      expect(pageSrc).toContain("AuditReasonField");
    });

    it("calls setTournamentLicenseStatus with active status and audit reason", () => {
      expect(pageSrc).toContain('setTournamentLicenseStatus(grantTarget.id, "active", grantReason.trim())');
    });
  });

  describe("5. Backend & Contract Alignment", () => {
    it("AdminTournamentRow type includes auctionCode", () => {
      expect(authLibSrc).toContain("auctionCode?: string | null;");
    });

    it("backend route /auth/admin/tournaments serializes auctionCode", () => {
      expect(authRouteSrc).toContain("auctionCode: t.auctionCode ?? null");
    });
  });
});
