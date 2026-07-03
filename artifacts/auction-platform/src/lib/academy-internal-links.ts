import { BLOG_POSTS_META, type BlogPostMeta } from "@workspace/blog-data";
import type { PublicAcademyLessonDetail } from "@/lib/academy-public";

export type ContextualSiteLink = { label: string; href: string; group: "blog" | "product" | "site" };

const PRODUCT_LINKS_BY_KEY: Record<string, Array<{ label: string; href: string }>> = {
  cricket: [{ label: "Cricket Auction Software", href: "/cricket-auction-software" }],
  football: [{ label: "Football Player Auction", href: "/football-player-auction" }],
  kabaddi: [{ label: "Kabaddi Auction Platform", href: "/kabaddi-auction-platform" }],
  badminton: [{ label: "Badminton Auction Platform", href: "/badminton-auction-platform" }],
  auction: [
    { label: "Sports Auction Software", href: "/sports-auction-software" },
    { label: "Franchise Auction Software", href: "/franchise-auction-software" },
  ],
  platform: [
    { label: "Tournament Auction Platform", href: "/tournament-auction-platform" },
    { label: "Player Auction Software", href: "/player-auction-software" },
  ],
};

const SITE_LINKS: Array<{ label: string; href: string }> = [
  { label: "Create Free Tournament", href: "/tournament/new" },
  { label: "Sports Auction Software", href: "/sports-auction-software" },
  { label: "Tournament Auction Platform", href: "/tournament-auction-platform" },
  { label: "Auction Tips & Guides", href: "/auction-tips" },
  { label: "BidWar Blog", href: "/blog" },
  { label: "Contact & Pricing", href: "/contact" },
];

export function findRelatedBlogPosts(lesson: PublicAcademyLessonDetail, limit = 3): BlogPostMeta[] {
  const haystack = `${lesson.title} ${lesson.categoryName ?? ""} ${lesson.shortDescription ?? ""}`.toLowerCase();
  const tokens = haystack.split(/\W+/).filter((t) => t.length > 3);

  return BLOG_POSTS_META.map((post) => {
    const text = `${post.title} ${post.description} ${post.tags.join(" ")} ${post.category}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (text.includes(token)) score += 1;
    }
    if (lesson.categorySlug && post.category === lesson.categorySlug) score += 3;
    return { post, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post);
}

export function findRelatedProductPages(categorySlug: string | null | undefined) {
  if (!categorySlug) {
    return [
      { label: "Sports Auction Software", href: "/sports-auction-software" },
      { label: "Contact BidWar", href: "/contact" },
    ];
  }

  const slug = categorySlug.toLowerCase();
  for (const [key, links] of Object.entries(PRODUCT_LINKS_BY_KEY)) {
    if (slug.includes(key)) return links;
  }

  return PRODUCT_LINKS_BY_KEY.auction!;
}

/** Contextual internal links for blog, product pages, and core site destinations. */
export function findContextualSiteLinks(lesson: PublicAcademyLessonDetail, limit = 6): ContextualSiteLink[] {
  const blog = findRelatedBlogPosts(lesson, 2).map((post) => ({
    label: post.title,
    href: `/blog/${post.slug}`,
    group: "blog" as const,
  }));
  const products = findRelatedProductPages(lesson.categorySlug).map((link) => ({
    ...link,
    group: "product" as const,
  }));
  const site = SITE_LINKS.filter(
    (link) => !products.some((p) => p.href === link.href) && !blog.some((b) => b.href === link.href),
  ).slice(0, 3).map((link) => ({ ...link, group: "site" as const }));

  return [...blog, ...products, ...site].slice(0, limit);
}
