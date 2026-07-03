import { BLOG_POSTS_META, getAllBlogUrls } from "@workspace/blog-data";
import { ALL_PUBLIC_PATHS, BASE_URL, type PageMeta } from "./page-meta.js";
import { buildCanonical, safeLastmod } from "./seo-canonical.js";
import { isCricketPublicPath } from "./cricket-page-meta.js";
import { isRegistrationPublicPath } from "./registration-page-meta.js";

export type RouteDisposition = "indexable" | "noindex-app" | "not-found";

const KNOWN_LEGAL_SLUGS = new Set([
  "terms",
  "privacy",
  "acceptable-use",
  "disclaimer",
  "refund",
]);

/** Paths blocked in robots.txt — kept in one place for policy-driven generation. */
export const ROBOTS_DISALLOW_PREFIXES = [
  "/tournament/",
  "/admin/",
  "/admin",
  "/organizer",
  "/organizer/",
  "/complete-profile",
  "/wa-consent/",
  "/api/",
  "/live/",
  "/dashboard",
  "/owner-app/",
  "/scoring-app/",
] as const;

/** Explicit Allow entries for high-value commercial URLs (robots.txt hint). */
export const ROBOTS_ALLOW_PATHS = [
  "/upcoming-auctions",
  "/contact",
  "/auction-tips",
  "/legal/",
  "/blog",
  "/blog/",
  "/sports-auction-software",
  "/cricket-auction-software",
  "/badminton-scoring-software",
  "/franchise-auction-software",
  "/player-auction-software",
  "/sports-league-management-software",
  "/football-player-auction",
  "/kabaddi-auction-platform",
  "/tournament-auction-platform",
  "/basketball-auction-software",
  "/badminton-auction-platform",
  "/volleyball-player-auction",
  "/esports-auction-system",
  "/business-league-auction",
  "/live-player-bidding",
] as const;

const PUBLIC_INDEXABLE_EXACT = new Set(ALL_PUBLIC_PATHS);

/**
 * Known SPA routes that exist in the client router but must never be indexed.
 * Unmatched paths are treated as 404.
 */
const NOINDEX_SPA_ROUTE_RES: RegExp[] = [
  /^\/dashboard$/,
  /^\/live(?:\/\d+)?$/,
  /^\/register\/[A-Za-z0-9-]+$/,
  /^\/tournament\/new$/,
  /^\/tournament\/\d+\/(?:login|display|side-display|score-display|liveviewer|register|obs\/preview|obs)$/,
  /^\/tournament\/\d+\/owner\/\d+$/,
  /^\/badminton\/\d+\/(?:score|display|overlay)$/,
  /^\/wa-consent\/[^/]+$/,
  /^\/complete-profile$/,
  /^\/organizer(?:\/.*)?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/tournament\/\d+(?:\/.*)?$/,
  /^\/tournament\/\d+\/(?:cricket|score|badminton)(?:\/.*)?$/,
  /^\/cricket\/leaderboards$/,
  /^\/player\/[^/]+$/,
];

function matchesAny(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(pathname));
}

function isPublicContentPath(pathname: string): boolean {
  if (PUBLIC_INDEXABLE_EXACT.has(pathname)) return true;
  if (pathname === "/legal") return true;
  if (/^\/legal\/[a-z-]+$/.test(pathname)) return true;
  if (/^\/blog(?:\/|$)/.test(pathname)) return true;
  return false;
}

function isKnownNoindexSpaRoute(pathname: string): boolean {
  if (ROBOTS_DISALLOW_PREFIXES.some((prefix) =>
    prefix.endsWith("/")
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  )) {
    return true;
  }
  return matchesAny(pathname, NOINDEX_SPA_ROUTE_RES);
}

/**
 * Returns true when the path looks like public marketing/blog content
 * but must be validated via getPageMeta (or related resolvers).
 */
export function expectsPublicMeta(pathname: string): boolean {
  if (isRegistrationPublicPath(pathname)) return true;
  if (isCricketPublicPath(pathname)) return true;
  return isPublicContentPath(pathname);
}

/**
 * Classify a pathname for the HTML catch-all handler.
 * Indexable public pages are handled earlier by the meta-injection middleware.
 */
export function classifyRoute(pathname: string, hasResolvedMeta: boolean): RouteDisposition {
  if (hasResolvedMeta) return "indexable";

  if (expectsPublicMeta(pathname)) {
    return "not-found";
  }

  if (isKnownNoindexSpaRoute(pathname)) {
    return "noindex-app";
  }

  return "not-found";
}

export function isPrivatePath(pathname: string): boolean {
  return isKnownNoindexSpaRoute(pathname);
}

export function getNotFoundPageMeta(): PageMeta {
  return {
    title: "Page Not Found | BidWar",
    description: "The page you requested could not be found on BidWar.",
    robots: "noindex, follow",
    omitCanonical: true,
    schemas: [],
  };
}

export function getPrivatePageMeta(pathname: string): PageMeta {
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return {
      title: "BidWar Admin Sign In",
      description: "Sign in to the BidWar admin console.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  if (pathname.startsWith("/admin")) {
    return {
      title: "BidWar Admin Console",
      description: "BidWar platform administration.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  if (pathname.startsWith("/organizer") || pathname === "/dashboard") {
    return {
      title: "BidWar Organizer Portal",
      description: "Manage your sports tournaments and auctions on BidWar.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  if (pathname.startsWith("/live")) {
    return {
      title: "BidWar Live Viewer",
      description: "Watch a live sports auction on BidWar.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  if (pathname.startsWith("/tournament/")) {
    return {
      title: "BidWar Tournament",
      description: "Tournament operations on BidWar.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  if (pathname === "/complete-profile") {
    return {
      title: "Complete Your BidWar Profile",
      description: "Finish setting up your BidWar organizer profile.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  if (pathname.startsWith("/wa-consent/")) {
    return {
      title: "WhatsApp Consent | BidWar",
      description: "Manage WhatsApp notification consent for BidWar.",
      robots: "noindex, nofollow",
      omitCanonical: true,
      schemas: [],
    };
  }

  return {
    title: "BidWar App",
    description: "BidWar sports auction and tournament platform.",
    robots: "noindex, nofollow",
    omitCanonical: true,
    schemas: [],
  };
}

export function isKnownLegalSlug(pathname: string): boolean {
  const match = pathname.match(/^\/legal\/([a-z-]+)$/);
  if (!match) return false;
  return KNOWN_LEGAL_SLUGS.has(match[1]!);
}

export function buildRobotsTxt(host: string = "bidwar.in"): string {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Block authenticated/private app pages",
    ...ROBOTS_DISALLOW_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    "",
    "# Core marketing pages",
    ...ROBOTS_ALLOW_PATHS.map((path) => `Allow: ${path}`),
    "",
    `Sitemap: https://${host}/sitemap-index.xml`,
  ];
  return lines.join("\n");
}

export type SitemapEntry = {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
};

function entry(
  loc: string,
  changefreq: string,
  priority: string,
  lastmod?: string | Date | null,
): SitemapEntry {
  return {
    loc,
    changefreq,
    priority,
    lastmod: safeLastmod(lastmod ?? undefined),
  };
}

function renderUrlset(urls: SitemapEntry[]): string {
  const urlXml = urls
    .map((u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlXml}\n\n</urlset>`;
}

function renderSitemapIndex(sitemaps: Array<{ loc: string; lastmod: string }>): string {
  const body = sitemaps
    .map(
      (s) =>
        `  <sitemap>\n    <loc>${s.loc}</loc>\n    <lastmod>${s.lastmod}</lastmod>\n  </sitemap>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

function renderImageUrlset(
  images: Array<{ pageLoc: string; imageLoc: string; title?: string }>,
): string {
  if (images.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n</urlset>`;
  }

  const byPage = new Map<string, Array<{ imageLoc: string; title?: string }>>();
  for (const img of images) {
    const list = byPage.get(img.pageLoc) ?? [];
    list.push({ imageLoc: img.imageLoc, title: img.title });
    byPage.set(img.pageLoc, list);
  }

  const urlXml = [...byPage.entries()]
    .map(([pageLoc, imgs]) => {
      const imageTags = imgs
        .map((img) => {
          const titleTag = img.title
            ? `\n      <image:title>${escapeXml(img.title)}</image:title>`
            : "";
          return `    <image:image>\n      <image:loc>${escapeXml(img.imageLoc)}</image:loc>${titleTag}\n    </image:image>`;
        })
        .join("\n");
      return `  <url>\n    <loc>${escapeXml(pageLoc)}</loc>\n${imageTags}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urlXml}\n</urlset>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolveImageUrl(image: string): string {
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${BASE_URL}${image.startsWith("/") ? image : `/${image}`}`;
}

export function buildSitemapPages(): string {
  const today = safeLastmod(new Date())!;

  const urls: SitemapEntry[] = [
    entry(`${BASE_URL}/`, "weekly", "1.0", today),
    entry(`${BASE_URL}/upcoming-auctions`, "daily", "0.8", today),
    entry(`${BASE_URL}/contact`, "monthly", "0.7", today),
    entry(`${BASE_URL}/auction-tips`, "monthly", "0.7", today),
    entry(`${BASE_URL}/legal/terms`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/privacy`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/acceptable-use`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/disclaimer`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/refund`, "yearly", "0.3"),
    entry(`${BASE_URL}/sports-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/cricket-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/badminton-scoring-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/franchise-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/player-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/sports-league-management-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/football-player-auction`, "monthly", "0.8", today),
    entry(`${BASE_URL}/kabaddi-auction-platform`, "monthly", "0.8", today),
    entry(`${BASE_URL}/tournament-auction-platform`, "monthly", "0.8", today),
    entry(`${BASE_URL}/basketball-auction-software`, "monthly", "0.8", today),
    entry(`${BASE_URL}/badminton-auction-platform`, "monthly", "0.8", today),
    entry(`${BASE_URL}/volleyball-player-auction`, "monthly", "0.8", today),
    entry(`${BASE_URL}/esports-auction-system`, "monthly", "0.7", today),
    entry(`${BASE_URL}/business-league-auction`, "monthly", "0.7", today),
    entry(`${BASE_URL}/live-player-bidding`, "monthly", "0.7", today),
  ];

  return renderUrlset(urls);
}

export function buildSitemapBlog(): string {
  const today = safeLastmod(new Date())!;

  const urls: SitemapEntry[] = [
    entry(`${BASE_URL}/blog`, "weekly", "0.8", today),
    ...BLOG_POSTS_META.map((p) =>
      entry(p.canonical, "monthly", "0.7", p.updatedAt ?? p.publishedAt),
    ),
  ];

  return renderUrlset(urls);
}

export function buildSitemapTaxonomy(): string {
  const today = safeLastmod(new Date())!;

  const taxonomyUrls = getAllBlogUrls().filter(
    (u) => u.includes("/blog/category/") || u.includes("/blog/author/"),
  );

  const urls: SitemapEntry[] = taxonomyUrls.map((u) =>
    entry(u, "weekly", "0.6", today),
  );

  return renderUrlset(urls);
}

export function buildSitemapImages(): string {
  const images = BLOG_POSTS_META.flatMap((post) => {
    if (!post.heroImage) return [];
    return [{
      pageLoc: post.canonical,
      imageLoc: resolveImageUrl(post.heroImage),
      title: post.title,
    }];
  });

  return renderImageUrlset(images);
}

export function buildSitemapIndex(): string {
  const today = safeLastmod(new Date())!;

  return renderSitemapIndex([
    { loc: `${BASE_URL}/sitemap-pages.xml`, lastmod: today },
    { loc: `${BASE_URL}/sitemap-blog.xml`, lastmod: today },
    { loc: `${BASE_URL}/sitemap-taxonomy.xml`, lastmod: today },
    { loc: `${BASE_URL}/sitemap-images.xml`, lastmod: today },
  ]);
}

/** Legacy monolithic sitemap — kept for backwards compatibility. */
export function buildLegacySitemapXml(): string {
  const today = safeLastmod(new Date())!;

  const combined: SitemapEntry[] = [
    entry(`${BASE_URL}/`, "weekly", "1.0", today),
    entry(`${BASE_URL}/upcoming-auctions`, "daily", "0.8", today),
    entry(`${BASE_URL}/contact`, "monthly", "0.7", today),
    entry(`${BASE_URL}/auction-tips`, "monthly", "0.7", today),
    entry(`${BASE_URL}/legal/terms`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/privacy`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/acceptable-use`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/disclaimer`, "yearly", "0.3"),
    entry(`${BASE_URL}/legal/refund`, "yearly", "0.3"),
    entry(`${BASE_URL}/sports-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/cricket-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/badminton-scoring-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/franchise-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/player-auction-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/sports-league-management-software`, "monthly", "0.9", today),
    entry(`${BASE_URL}/football-player-auction`, "monthly", "0.8", today),
    entry(`${BASE_URL}/kabaddi-auction-platform`, "monthly", "0.8", today),
    entry(`${BASE_URL}/tournament-auction-platform`, "monthly", "0.8", today),
    entry(`${BASE_URL}/basketball-auction-software`, "monthly", "0.8", today),
    entry(`${BASE_URL}/badminton-auction-platform`, "monthly", "0.8", today),
    entry(`${BASE_URL}/volleyball-player-auction`, "monthly", "0.8", today),
    entry(`${BASE_URL}/esports-auction-system`, "monthly", "0.7", today),
    entry(`${BASE_URL}/business-league-auction`, "monthly", "0.7", today),
    entry(`${BASE_URL}/live-player-bidding`, "monthly", "0.7", today),
    entry(`${BASE_URL}/blog`, "weekly", "0.8", today),
    ...BLOG_POSTS_META.map((p) =>
      entry(p.canonical, "monthly", "0.7", p.updatedAt ?? p.publishedAt),
    ),
    ...getAllBlogUrls()
      .filter((u) => u.includes("/blog/category/") || u.includes("/blog/author/"))
      .map((u) => entry(u, "weekly", "0.6", today)),
  ];

  return renderUrlset(combined);
}

export { buildCanonical };
