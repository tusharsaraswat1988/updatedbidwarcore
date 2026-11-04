import { describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";

vi.mock("../homepage-data.js", () => ({
  fetchHomepagePageData: vi.fn().mockResolvedValue({
    cacheHit: false,
    data: {
      auctions: [],
      showcaseEvents: [],
      clients: [],
      branding: { brandName: "BidWar" },
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

import { loadRenderHomePage, resolveSsrBundlePath } from "../homepage-ssr.js";
import { classifyRoute } from "../seo-route-policy.js";
import { getPageMeta } from "../page-meta.js";

describe("P0 Forensic Audit Verification", () => {
  describe("P0-1: Production Homepage SSR", () => {
    it("SSR bundle resolves and renders >50KB of HTML containing H1 and rich content", async () => {
      const bundlePath = resolveSsrBundlePath();
      expect(bundlePath).toBeTruthy();

      const renderer = await loadRenderHomePage();
      expect(renderer).not.toBeNull();
      expect(typeof renderer).toBe("function");

      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar", companyName: "BidWar Tech" },
        generatedAt: new Date().toISOString(),
      });

      // Verify HTML size is substantial (full rendered page, not empty boot shell)
      expect(result.appHtml.length).toBeGreaterThan(50000);

      // Verify commercial H1 exists in server-rendered output
      expect(result.appHtml).toMatch(/<h1[^>]*>[\s\S]*?Sports Auction Software[\s\S]*?<\/h1>/i);
      expect(result.appHtml).toContain("From Auction to Champions");

      // Verify no boot splash inside rendered app
      expect(result.appHtml).not.toContain('id="bidwar-boot-splash"');

      // Verify dehydrated state and initialData are returned
      expect(result.dehydratedState).toBeDefined();
      expect(result.initialData).toBeDefined();
    });
  });

  describe("P0-2: Public Routes /pricing and /bpl", () => {
    it("resolves metadata and classifies /pricing, /bpl, and /bpl/:edition as indexable public routes", () => {
      expect(getPageMeta("/pricing")).not.toBeNull();
      expect(getPageMeta("/bpl")).not.toBeNull();
      expect(getPageMeta("/bpl/2026")).not.toBeNull();

      expect(classifyRoute("/pricing", Boolean(getPageMeta("/pricing")))).toBe("indexable");
      expect(classifyRoute("/bpl", Boolean(getPageMeta("/bpl")))).toBe("indexable");
      expect(classifyRoute("/bpl/2026", Boolean(getPageMeta("/bpl/2026")))).toBe("indexable");
    });

    it("returns not-found for nonexistent routes", () => {
      expect(getPageMeta("/definitely-not-found-404-page")).toBeNull();
      expect(classifyRoute("/definitely-not-found-404-page", false)).toBe("not-found");
      expect(classifyRoute("/pricing/extra/nested/path", false)).toBe("not-found");
    });

    it("generates correct metadata and canonical URLs for /pricing and /bpl", () => {
      const pricingMeta = getPageMeta("/pricing")!;
      expect(pricingMeta.title).toContain("Pricing");
      expect(pricingMeta.canonical).toBe("https://bidwar.in/pricing");
      expect(pricingMeta.description.length).toBeGreaterThan(20);
      expect(pricingMeta.schemas.length).toBeGreaterThan(0);

      const bplMeta = getPageMeta("/bpl")!;
      expect(bplMeta.title).toContain("BidWar Premier League");
      expect(bplMeta.canonical).toBe("https://bidwar.in/bpl");
      expect(bplMeta.description.length).toBeGreaterThan(20);

      const bplEditionMeta = getPageMeta("/bpl/2026")!;
      expect(bplEditionMeta.title).toContain("BidWar Premier League");
      expect(bplEditionMeta.canonical).toBe("https://bidwar.in/bpl/2026");
    });
  });

  describe("P0-3: Homepage Navigation Anchors Integrity", () => {
    it("renders all critical navigation anchor targets in the homepage DOM", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Primary canonical anchors
      expect(html).toContain('id="auction-screens"');
      expect(html).toContain('id="offerings"');
      expect(html).toContain('id="simulator"');
      expect(html).toContain('id="features"');
      expect(html).toContain('id="sports"');

      // Backward-compatible alias anchors
      expect(html).toContain('id="experience-bidding"');
      expect(html).toContain('id="solutions"');
      expect(html).toContain('id="calculator"');
    });
  });

  describe("P0-4: Mobile Layout & Responsiveness Integrity", () => {
    it("renders root container with overflow-x-clip and responsive header elements", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Root container has overflow-x-clip to prevent horizontal document-level scroll jitter
      expect(html).toContain("overflow-x-clip");

      // Right action buttons container has shrink-0 to prevent button truncation
      expect(html).toContain("shrink-0");
    });
  });
});
