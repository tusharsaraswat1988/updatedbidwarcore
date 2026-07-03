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

import { BLOG_POSTS_META } from "@workspace/blog-data";
import { BASE_URL, getPageMeta } from "../page-meta.js";
import {
  auditSitemapDiscovery,
  buildRobotsTxt,
  buildSitemapBlog,
  buildSitemapIndex,
  extractSitemapLocs,
  getDiscoverablePageLocs,
  SITEMAP_CHILD_FILES,
} from "../seo-route-policy.js";
import { isSeoAssetPath } from "../register-seo-routes.js";

describe("sitemap discovery audit", () => {
  it("isSeoAssetPath identifies crawl asset routes", () => {
    expect(isSeoAssetPath("/robots.txt")).toBe(true);
    expect(isSeoAssetPath("/sitemap-blog.xml")).toBe(true);
    expect(isSeoAssetPath("/blog/foo")).toBe(false);
  });

  it("buildRobotsTxt declares only sitemap-index.xml for Search Console", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("Sitemap: https://bidwar.in/sitemap-index.xml");
    expect(robots).not.toContain("Sitemap: https://bidwar.in/sitemap.xml");
    expect(robots.match(/^Sitemap:/gm)).toHaveLength(1);
    expect(robots).not.toMatch(/Sitemap: \/sitemap/);
  });

  it("auditSitemapDiscovery passes for the full site", () => {
    const audit = auditSitemapDiscovery();

    expect(audit.validXml).toBe(true);
    expect(audit.includesHomepage).toBe(true);
    expect(audit.includesBlogIndex).toBe(true);
    expect(audit.includesAllArticles).toBe(true);
    expect(audit.includesCategoryPages).toBe(true);
    expect(audit.includesAuthorPages).toBe(true);
    expect(audit.includesLandingPages).toBe(true);
    expect(audit.exampleArticlePresent).toBe(true);
    expect(audit.duplicateLocs).toEqual([]);
    expect(audit.missingBlogArticles).toEqual([]);
    expect(audit.canonicalMismatches).toEqual([]);
    expect(audit.orphanChildSitemaps).toEqual([]);
    expect(audit.indexChildCount).toBe(SITEMAP_CHILD_FILES.length);
    expect(audit.combinedUrlCount).toBeGreaterThan(50);
    expect(audit.blogUrlCount).toBe(BLOG_POSTS_META.length + 1);
  });

  it("each blog article appears exactly once in sitemap-blog.xml", () => {
    const locs = extractSitemapLocs(buildSitemapBlog());
    const blogArticleLocs = locs.filter(
      (u) =>
        u.startsWith(`${BASE_URL}/blog/`) &&
        !u.includes("/category/") &&
        !u.includes("/author/"),
    );

    expect(blogArticleLocs.length).toBe(BLOG_POSTS_META.length);
    expect(new Set(blogArticleLocs).size).toBe(BLOG_POSTS_META.length);
  });

  it("sitemap URLs match page canonical and og:url for blog articles", () => {
    const combined = getDiscoverablePageLocs();
    for (const post of BLOG_POSTS_META) {
      const meta = getPageMeta(`/blog/${post.slug}`);
      expect(meta?.canonical).toBe(post.canonical);
      expect(combined).toContain(post.canonical);
      expect(buildSitemapBlog()).toContain(post.canonical);
    }
  });

  it("sitemap-index references all child sitemaps with no orphans", () => {
    const index = buildSitemapIndex();
    for (const file of SITEMAP_CHILD_FILES) {
      expect(index).toContain(`${BASE_URL}/${file}`);
    }
    expect(extractSitemapLocs(index)).toHaveLength(SITEMAP_CHILD_FILES.length);
  });

  it("franchise-league example article is reachable through the index chain", () => {
    const url = `${BASE_URL}/blog/franchise-league-software-features-matter-most`;
    const combined = getDiscoverablePageLocs();
    expect(combined.filter((l) => l === url)).toHaveLength(1);
  });
});
