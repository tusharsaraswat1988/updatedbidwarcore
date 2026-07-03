import { describe, expect, it, vi } from "vitest";

vi.mock("../branding-service.js", () => ({
  getPlatformOpenGraphImageUrl: () => null,
}));

vi.mock("../cricket-page-meta.js", () => ({
  isCricketPublicPath: () => false,
}));

vi.mock("../registration-page-meta.js", () => ({
  isRegistrationPublicPath: () => false,
}));

import { buildCanonical, safeLastmod } from "../seo-canonical.js";
import {
  buildRobotsTxt,
  buildSitemapBlog,
  buildSitemapIndex,
  buildSitemapPages,
  classifyRoute,
  getNotFoundPageMeta,
  getPrivatePageMeta,
} from "../seo-route-policy.js";
import { getPageMeta } from "../page-meta.js";

describe("seo-canonical", () => {
  it("buildCanonical strips UTM parameters", () => {
    expect(buildCanonical("/sports-auction-software?utm_source=test", "https://bidwar.in"))
      .toBe("https://bidwar.in/sports-auction-software");
  });

  it("buildCanonical preserves homepage trailing slash", () => {
    expect(buildCanonical("/", "https://bidwar.in")).toBe("https://bidwar.in/");
  });

  it("buildCanonical removes trailing slash on non-root paths", () => {
    expect(buildCanonical("/contact/", "https://bidwar.in")).toBe("https://bidwar.in/contact");
  });

  it("safeLastmod caps future dates to today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(safeLastmod("2099-01-01")).toBe(today);
  });

  it("safeLastmod passes valid past dates through", () => {
    expect(safeLastmod("2026-05-15")).toBe("2026-05-15");
  });
});

describe("seo-route-policy", () => {
  it("classifies unknown marketing URLs as not-found", () => {
    expect(classifyRoute("/this-page-should-not-exist", false)).toBe("not-found");
  });

  it("classifies admin routes as noindex-app", () => {
    expect(classifyRoute("/admin", false)).toBe("noindex-app");
    expect(classifyRoute("/admin/tournaments", false)).toBe("noindex-app");
  });

  it("classifies organizer routes as noindex-app", () => {
    expect(classifyRoute("/organizer", false)).toBe("noindex-app");
    expect(classifyRoute("/dashboard", false)).toBe("noindex-app");
  });

  it("returns 404 metadata without canonical", () => {
    const meta = getNotFoundPageMeta();
    expect(meta.robots).toBe("noindex, follow");
    expect(meta.omitCanonical).toBe(true);
    expect(meta.canonical).toBeUndefined();
  });

  it("returns private metadata without homepage canonical", () => {
    const meta = getPrivatePageMeta("/admin");
    expect(meta.robots).toBe("noindex, nofollow");
    expect(meta.omitCanonical).toBe(true);
    expect(meta.title).toContain("Admin");
  });

  it("buildRobotsTxt references sitemap-index only and blocks private paths", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("Sitemap: https://bidwar.in/sitemap-index.xml");
    expect(robots).not.toContain("Sitemap: https://bidwar.in/sitemap.xml");
    expect(robots.match(/^Sitemap:/gm)).toHaveLength(1);
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Allow: /auction-tips");
  });

  it("buildSitemapIndex lists all sub-sitemaps", () => {
    const xml = buildSitemapIndex();
    expect(xml).toContain("sitemap-pages.xml");
    expect(xml).toContain("sitemap-blog.xml");
    expect(xml).toContain("sitemap-taxonomy.xml");
    expect(xml).toContain("sitemap-images.xml");
  });

  it("buildSitemapBlog never emits future lastmod dates", () => {
    const xml = buildSitemapBlog();
    const today = new Date().toISOString().slice(0, 10);
    for (const match of xml.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)) {
      expect(match[1]! <= today).toBe(true);
    }
  });

  it("buildSitemapPages includes auction-tips and legal disclaimer/refund", () => {
    const xml = buildSitemapPages();
    expect(xml).toContain("/auction-tips");
    expect(xml).toContain("/legal/disclaimer");
    expect(xml).toContain("/legal/refund");
  });

  it("getPageMeta returns null for unknown legal slugs", () => {
    expect(getPageMeta("/legal/not-a-real-policy")).toBeNull();
  });

  it("getPageMeta includes auction-tips", () => {
    const meta = getPageMeta("/auction-tips");
    expect(meta?.canonical).toBe("https://bidwar.in/auction-tips");
    expect(meta?.robots ?? "index, follow").toBe("index, follow");
  });

  it("getPageMeta returns null for invalid blog article slugs", () => {
    expect(getPageMeta("/blog/this-slug-does-not-exist-xyz")).toBeNull();
  });
});
