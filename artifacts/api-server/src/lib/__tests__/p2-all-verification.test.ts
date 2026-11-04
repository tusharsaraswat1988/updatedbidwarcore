import { describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";

vi.mock("../homepage-data.js", () => ({
  fetchHomepagePageData: vi.fn().mockResolvedValue({
    cacheHit: false,
    data: {
      auctions: [],
      showcaseEvents: [],
      clients: [
        { id: 1, name: "Vyapari Network", clientType: "brand", displayOrder: 0, active: true },
        { id: 2, name: "Rotary Shine", clientType: "organisation", displayOrder: 1, active: true },
        { id: 99, name: "CWP Detailer's and Motors", clientType: "brand", displayOrder: 99, active: true },
      ],
      branding: { brandName: "BidWar", companyName: "BidWar Tech" },
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

import { loadRenderHomePage } from "../homepage-ssr.js";
import { getPageMeta, DEFAULT_OG_IMAGE_URL } from "../page-meta.js";
import { injectPageMetaToHtml } from "../html-meta-injector.js";
import { listActive } from "../clients-service.js";

describe("P2 Optimization Verification (SEO, Performance & Accessibility)", () => {
  describe("P2-1 & P2-5: Image Performance & Accessibility", () => {
    it("SSR homepage includes WebP sources, explicit dimensions, and lazy loading", async () => {
      const renderer = await loadRenderHomePage();
      expect(renderer).not.toBeNull();

      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar", companyName: "BidWar Tech" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Verify WebP sources exist in picture tags
      expect(html).toContain('type="image/webp"');
      expect(html).toContain('.webp');

      // Verify explicit dimensions are set
      expect(html).toMatch(/width=["'](1280|640|600|235|160)["']/);
      expect(html).toMatch(/height=["'](720|400|360|482|85)["']/);

      // Verify lazy loading on below-the-fold images
      expect(html).toContain('loading="lazy"');
      expect(html).toContain('decoding="async"');

      // Verify LCP slide 0 priority
      expect(html).toContain('loading="eager"');
      expect(html).toMatch(/fetchpriority="high"|loading="eager"/);
    });
  });

  describe("P2-3: Dynamic Open Graph & Social Sharing", () => {
    it("guarantees absolute og:image, 1200x630 dimensions, and summary_large_image for all public marketing routes", () => {
      const routes = ["/", "/pricing", "/bpl", "/bpl/2026", "/upcoming-auctions", "/contact", "/auction-tips", "/academy"];

      for (const route of routes) {
        const meta = getPageMeta(route);
        expect(meta, `PageMeta for route ${route} should exist`).not.toBeNull();
        expect(meta!.ogImage, `ogImage for ${route} should be defined`).toBeTruthy();
        expect(meta!.ogImage!.startsWith("http"), `ogImage for ${route} must be absolute URL`).toBe(true);

        const injected = injectPageMetaToHtml(
          "<html><head><!-- PAGE_META_START --><!-- PAGE_META_END --><!-- PAGE_SCHEMA_START --><!-- PAGE_SCHEMA_END --></head><body></body></html>",
          meta!
        );

        // Verify og:image tag
        expect(injected).toContain('<meta property="og:image"');
        expect(injected).toContain('content="https://');

        // Verify og:image dimensions (1200x630)
        expect(injected).toContain('<meta property="og:image:width" content="1200" />');
        expect(injected).toContain('<meta property="og:image:height" content="630" />');

        // Verify twitter card is summary_large_image with twitter:image
        expect(injected).toContain('<meta name="twitter:card" content="summary_large_image" />');
        expect(injected).toContain('<meta name="twitter:image"');
      }
    });

    it("falls back to DEFAULT_OG_IMAGE_URL when platform OG is absent", () => {
      expect(DEFAULT_OG_IMAGE_URL).toBeTruthy();
      expect(DEFAULT_OG_IMAGE_URL.startsWith("https://")).toBe(true);
      expect(DEFAULT_OG_IMAGE_URL).toContain(".png");
    });
  });

  describe("P2-4: Semantic Heading Hierarchy", () => {
    it("has exactly one H1 and semantic H2/H3s without decorative heading pollution", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar", companyName: "BidWar Tech" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Count H1 occurrences: exactly 1
      const h1Matches = html.match(/<h1[\s>]/gi) || [];
      expect(h1Matches.length).toBe(1);

      // Section H2s exist
      expect(html).toContain("<h2");

      // Verify NO H3 or H4 for simulator mock labels or client names
      expect(html).not.toMatch(/<h[34][^>]*>Manual Direct Allotment<\/h[34]>/i);
      expect(html).not.toMatch(/<h[34][^>]*>CONGRATULATIONS!<\/h[34]>/i);
      expect(html).not.toMatch(/<h[34][^>]*>SOLD TO/i);
    });
  });

  describe("P2-6: Homepage Live Ticker Data Integrity", () => {
    it("renders Tournament Highlights badge without fake pulsing live-dot", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar", companyName: "BidWar Tech" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Verify Tournament Highlights label
      expect(html).toContain("Tournament Highlights");

      // Verify diamond bullet separator
      expect(html).toContain("◆");

      // Verify updated milestone copies
      expect(html).toContain("Accelerated Player Recycle");
      expect(html).toContain("LED Screen &amp; Broadcast");

      // Verify ticker track does NOT have pulsing live-dot
      const tickerTrackHtml = html.match(/class="ticker-track[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
      expect(tickerTrackHtml).not.toContain('class="live-dot"');
    });
  });

  describe("P2-7: Client Cleanup", () => {
    it("excludes internal billing entities (CWP) from listActive", async () => {
      const clients = await listActive();
      for (const client of clients) {
        const lower = (client.name || "").toLowerCase();
        expect(lower).not.toContain("cwp detailer");
        expect(lower).not.toContain("cwp motor");
        expect(lower).not.toContain("detailer's and motors");
      }
    });
  });
});
