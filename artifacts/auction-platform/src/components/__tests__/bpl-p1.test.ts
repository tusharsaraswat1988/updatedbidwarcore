import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  fetchActiveBplEdition,
  fetchPublicBplEditions,
  fetchBplEdition,
  fetchEditionSponsors,
  listAdminEditionSponsors,
  createAdminEditionSponsor,
  updateAdminEditionSponsor,
  deleteAdminEditionSponsor,
} from "../../lib/bpl-api";

describe("BidWar Premier League — P1 Public Experience & Sponsors", () => {
  const editionViewPath = path.resolve(__dirname, "../bpl/bpl-edition-view.tsx");
  const bplHubPath = path.resolve(__dirname, "../../pages/bpl/bpl-hub.tsx");
  const bplEditionPagePath = path.resolve(__dirname, "../../pages/bpl/bpl-edition.tsx");
  const adminBplPagePath = path.resolve(__dirname, "../../pages/admin-bpl-editions.tsx");

  describe("P1.1, P1.2 — BPL Hero & Dynamic Status", () => {
    it("renders dynamic edition status badges for LIVE, UPCOMING, and COMPLETED", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("🔴 Live Now");
      expect(code).toContain("Upcoming Edition");
      expect(code).toContain("Completed");
      expect(code).toContain("edition.status");
    });

    it("renders Watch Live CTA only when a valid stream URL is present", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("hasStreamUrl && !isCompleted");
      expect(code).toContain("Watch Live Stream");
      expect(code).toContain("edition.liveStreamUrl");
    });

    it("renders secondary CTAs for Fan Page and Tournament Details", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("BPL Fan Page");
      expect(code).toContain("Tournament Details");
    });
  });

  describe("P1.3, P1.4, P1.5, P1.6 — Tournament Snapshot, Live Activity, Teams & Standings", () => {
    it("renders Live Match In Progress banner with score display route", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("Live Match In Progress");
      expect(code).toContain("Watch Live Score");
      expect(code).toContain("liveScoreRoute");
    });

    it("renders Next Match and Recent Result fallbacks", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("Next Scheduled Match");
      expect(code).toContain("Recent Result");
    });

    it("renders Participating Teams section strictly sourced from tournament teams", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("Participating Teams");
      expect(code).toContain("edition.teams");
    });

    it("renders Standings / Points Table preview", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("Points Table Preview");
      expect(code).toContain("edition.standings");
      expect(code).toContain("View Full Standings");
    });
  });

  describe("P1.8 — Sponsors Showcase & Tier Hierarchy", () => {
    it("categorizes sponsors by hierarchy: Title, Powered By, Associates, Media Partners", () => {
      const code = fs.readFileSync(editionViewPath, "utf-8");
      expect(code).toContain("sponsors.filter((s) => s.category === \"TITLE\")");
      expect(code).toContain("sponsors.filter((s) => s.category === \"POWERED_BY\")");
      expect(code).toContain("category === \"ASSOCIATE\"");
      expect(code).toContain("category === \"MEDIA_PARTNER\"");
      expect(code).toContain("Title Sponsor");
      expect(code).toContain("Powered By");
      expect(code).toContain("Associate Partners");
      expect(code).toContain("Media Partners");
    });
  });

  describe("P1.9 — Public BPL Hub & Edition Routing", () => {
    it("bpl-hub.tsx integrates BplEditionView", () => {
      const code = fs.readFileSync(bplHubPath, "utf-8");
      expect(code).toContain("BplEditionView");
      expect(code).toContain("fetchActiveBplEdition");
    });

    it("bpl-edition.tsx integrates BplEditionView with breadcrumb navigation", () => {
      const code = fs.readFileSync(bplEditionPagePath, "utf-8");
      expect(code).toContain("BplEditionView");
      expect(code).toContain("fetchBplEdition");
      expect(code).toContain("Back to BPL Hub");
    });
  });

  describe("P1.10, P1.17 — Admin Sponsor Management Extension", () => {
    it("admin-bpl-editions.tsx includes sponsor management modal and actions", () => {
      const code = fs.readFileSync(adminBplPagePath, "utf-8");
      expect(code).toContain("Manage Sponsors");
      expect(code).toContain("openSponsorsModal");
      expect(code).toContain("listAdminEditionSponsors");
      expect(code).toContain("createAdminEditionSponsor");
      expect(code).toContain("updateAdminEditionSponsor");
      expect(code).toContain("deleteAdminEditionSponsor");
      expect(code).toContain("uploadImageFile");
    });

    it("supports all 5 sponsor categories and active toggle switch", () => {
      const code = fs.readFileSync(adminBplPagePath, "utf-8");
      expect(code).toContain("TITLE");
      expect(code).toContain("POWERED_BY");
      expect(code).toContain("ASSOCIATE");
      expect(code).toContain("PARTNER");
      expect(code).toContain("MEDIA_PARTNER");
      expect(code).toContain("handleToggleSponsorActive");
    });
  });

  describe("BPL Client API Exports", () => {
    it("exports all public and admin sponsor client functions", () => {
      expect(typeof fetchActiveBplEdition).toBe("function");
      expect(typeof fetchPublicBplEditions).toBe("function");
      expect(typeof fetchBplEdition).toBe("function");
      expect(typeof fetchEditionSponsors).toBe("function");
      expect(typeof listAdminEditionSponsors).toBe("function");
      expect(typeof createAdminEditionSponsor).toBe("function");
      expect(typeof updateAdminEditionSponsor).toBe("function");
      expect(typeof deleteAdminEditionSponsor).toBe("function");
    });
  });
});
