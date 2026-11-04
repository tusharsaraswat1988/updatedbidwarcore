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

import { loadRenderHomePage } from "../homepage-ssr.js";
import { getPageMeta } from "../page-meta.js";
import { CANONICAL_PRICING_TIERS, buildSchemaOrgOffers } from "@workspace/api-base";
import { ORGANIZER_REVIEWS } from "../../../../auction-platform/src/components/home/organizer-video-reviews.js";

describe("P1 High-Impact Verification Suite", () => {
  describe("P1-1: Homepage Commercial SEO Positioning", () => {
    it("renders commercial H1 'IPL-Style Live Sports Auction Software' and maintains single H1 tag", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Assert primary commercial H1
      expect(html).toMatch(/<h1[^>]*>[\s\S]*?IPL-Style Live[\s\S]*?Sports Auction Software[\s\S]*?<\/h1>/i);

      // Assert exactly one H1 exists on the page
      const h1Count = (html.match(/<h1\b/gi) || []).length;
      expect(h1Count).toBe(1);

      // Assert subheading bridges brand motto with commercial intent
      expect(html).toContain("From Auction to Champions — Real-Time Bidding &amp; Tournament Engine.");

      // Assert page meta title aligns with commercial positioning
      const meta = getPageMeta("/")!;
      expect(meta.title).toBe("BidWar | IPL-Style Live Sports Auction Software");
    });
  });

  describe("P1-2: Pricing Consistency & Structured Data Integrity", () => {
    it("ensures canonical pricing tiers match checkout prices and visible UI", () => {
      expect(CANONICAL_PRICING_TIERS.length).toBe(7);

      const trial = CANONICAL_PRICING_TIERS.find((t) => t.id === "trial")!;
      expect(trial.sellingPrice).toBe(0);

      const starter = CANONICAL_PRICING_TIERS.find((t) => t.id === "starter")!;
      expect(starter.listPrice).toBe(5000);
      expect(starter.sellingPrice).toBe(3750);

      const pro = CANONICAL_PRICING_TIERS.find((t) => t.id === "pro")!;
      expect(pro.listPrice).toBe(6000);
      expect(pro.sellingPrice).toBe(4500);

      const advanced = CANONICAL_PRICING_TIERS.find((t) => t.id === "advanced")!;
      expect(advanced.listPrice).toBe(8000);
      expect(advanced.sellingPrice).toBe(6000);

      const elite = CANONICAL_PRICING_TIERS.find((t) => t.id === "elite")!;
      expect(elite.listPrice).toBe(9000);
      expect(elite.sellingPrice).toBe(6750);

      const premium = CANONICAL_PRICING_TIERS.find((t) => t.id === "premium")!;
      expect(premium.listPrice).toBe(11000);
      expect(premium.sellingPrice).toBe(8250);

      const champion = CANONICAL_PRICING_TIERS.find((t) => t.id === "champion")!;
      expect(champion.listPrice).toBe(12000);
      expect(champion.sellingPrice).toBe(9000);
    });

    it("builds valid Schema.org offers matching selling prices without fabricated aggregateRating", () => {
      const offers = buildSchemaOrgOffers();
      expect(offers.length).toBe(7);

      // Check prices in offers
      const offerPrices = offers.map((o) => o.price);
      expect(offerPrices).toEqual(["0", "3750", "4500", "6000", "6750", "8250", "9000"]);

      // Verify page meta schema does NOT contain fabricated aggregate rating
      const meta = getPageMeta("/")!;
      const schemasJson = JSON.stringify(meta.schemas);
      expect(schemasJson).not.toContain("aggregateRating");
      expect(schemasJson).not.toContain('"reviewCount":"500"');
    });
  });

  describe("P1-3: Canonical Host Configuration", () => {
    it("ensures canonical URL is always apex domain https://bidwar.in/", () => {
      const homeMeta = getPageMeta("/")!;
      expect(homeMeta.canonical).toBe("https://bidwar.in/");

      const pricingMeta = getPageMeta("/pricing")!;
      expect(pricingMeta.canonical).toBe("https://bidwar.in/pricing");
    });
  });

  describe("P1-4: Testimonials, Video Reviews & Trust Integrity", () => {
    it("removes fake durations from reviews without YouTube video", () => {
      for (const review of ORGANIZER_REVIEWS) {
        if (!review.youtubeId) {
          expect(review.duration).toBe("");
        } else {
          expect(review.duration.length).toBeGreaterThan(0);
        }
      }
    });

    it("server renders verified review badges for written testimonials and real play buttons for video reviews", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Playable videos have valid watch video button
      expect(html).toContain("Watch Video (00:37)");
      expect(html).toContain("Watch Video (00:45)");

      // Written reviews have verified badge
      expect(html).toContain("Verified Tournament Review");

      // Academy lessons have honest coming soon status instead of fake durations
      expect(html).toContain("Curriculum · Coming Soon");
      expect(html).toContain("View Academy Syllabus →");
      expect(html).not.toContain("12:04");
      expect(html).not.toContain("24:31");
    });
  });

  describe("P1-5: Conversion Flow & Semantic CTA Optimization", () => {
    it("renders semantic anchor links for Hero, Demo, Sticky, and Simulator CTAs", async () => {
      const renderer = await loadRenderHomePage();
      const result = renderer!({
        auctions: [],
        showcaseEvents: [],
        clients: [],
        branding: { brandName: "BidWar" },
        generatedAt: new Date().toISOString(),
      });

      const html = result.appHtml;

      // Hero primary signup CTA is an <a> tag
      expect(html).toMatch(/<a[^>]*href="\/organizer\?tab=signup"[^>]*>[\s\S]*?Start Free Trial/i);

      // Hero demo CTA is an <a> tag to WhatsApp
      expect(html).toMatch(/<a[^>]*href="https:\/\/wa\.me\/918707488250[^"]*"[^>]*>[\s\S]*?Book Live Demo/i);

      // Mobile sticky CTA is an <a> tag
      expect(html).toMatch(/<div data-home-sticky-cta=""[\s\S]*?<a[^>]*href="\/organizer\?tab=signup"/i);

      // Simulator has conversion bridge
      expect(html).toContain("Ready to run your auction?");
    });
  });
});
