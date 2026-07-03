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

import {
  BLOG_POSTS_META,
  auditPostDates,
  getPostDateModified,
  getPostDatePublished,
  getPostSitemapLastmod,
  isFutureIsoDate,
} from "@workspace/blog-data";
import { buildSitemapBlog } from "../seo-route-policy.js";
import { getPageMeta } from "../page-meta.js";

describe("blog date consistency", () => {
  const reference = new Date("2026-07-03T12:00:00.000Z");

  it("no published article has a future publish date", () => {
    for (const post of BLOG_POSTS_META) {
      expect(isFutureIsoDate(post.publishedAt, reference)).toBe(false);
    }
  });

  it("every post passes cross-channel date audit", () => {
    const rows = BLOG_POSTS_META.map((post) => auditPostDates(post, reference));
    const inconsistent = rows.filter((row) => !row.consistent);

    if (inconsistent.length > 0) {
      const report = inconsistent
        .map(
          (row) =>
            `${row.url}\n  issues: ${row.issues.join("; ")}`,
        )
        .join("\n");
      expect.fail(`Inconsistent blog dates:\n${report}`);
    }

    expect(rows.every((row) => row.consistent)).toBe(true);
  });

  it("sitemap lastmod matches clamped dateModified for each article", () => {
    const xml = buildSitemapBlog();
    for (const post of BLOG_POSTS_META) {
      const expected = getPostSitemapLastmod(post, reference);
      expect(xml).toContain(`<loc>${post.canonical}</loc>`);
      const block = xml.slice(
        xml.indexOf(`<loc>${post.canonical}</loc>`),
        xml.indexOf("</url>", xml.indexOf(`<loc>${post.canonical}</loc>`)),
      );
      expect(block).toContain(`<lastmod>${expected}</lastmod>`);
    }
  });

  it("SSR meta schema dates match shared blog date helpers", () => {
    for (const post of BLOG_POSTS_META) {
      const meta = getPageMeta(`/blog/${post.slug}`);
      expect(meta).not.toBeNull();

      const schema = meta!.schemas?.[0] as {
        "@graph"?: Array<{ datePublished?: string; dateModified?: string }>;
      };
      const blogPosting = schema?.["@graph"]?.find(
        (node) => node.datePublished !== undefined,
      );

      expect(blogPosting?.datePublished).toBe(getPostDatePublished(post));
      expect(blogPosting?.dateModified).toBe(getPostDateModified(post));
      expect(meta!.articlePublishedTime).toBe(`${getPostDatePublished(post)}T00:00:00.000Z`);
      expect(meta!.articleModifiedTime).toBe(`${getPostDateModified(post)}T00:00:00.000Z`);
      expect(meta!.ogType).toBe("article");
    }
  });

  it("franchise-league article dates are aligned end-to-end", () => {
    const slug = "franchise-league-software-features-matter-most";
    const post = BLOG_POSTS_META.find((p) => p.slug === slug)!;
    const audit = auditPostDates(post, reference);

    expect(audit.visibleDate).toBe("2026-07-03");
    expect(audit.sitemapLastmod).toBe("2026-07-03");
    expect(audit.schemaDatePublished).toBe("2026-07-03");
    expect(audit.schemaDateModified).toBe("2026-07-03");
    expect(audit.consistent).toBe(true);
  });
});
