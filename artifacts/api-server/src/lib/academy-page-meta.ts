import type { PageMeta } from "./page-meta.js";
import { BASE_URL } from "./page-meta.js";
import { getPlatformOpenGraphImageUrl } from "./branding-service.js";
import {
  fetchAcademyLessonPageData,
  getLessonMetaDescription,
  getLessonMetaTitle,
  type PublicAcademyLessonDetail,
} from "./academy-public-service.js";
import { toIsoDateTime } from "@workspace/blog-data";

const ACADEMY_LESSON_RE = /^\/academy\/([a-z0-9-]+)$/;

function withOg(meta: PageMeta): PageMeta {
  if (meta.ogImage) return meta;
  const platformOg = getPlatformOpenGraphImageUrl();
  return platformOg ? { ...meta, ogImage: platformOg } : meta;
}

function breadcrumbSchema(items: Array<{ name: string; item: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}

function buildLessonSchemas(lesson: PublicAcademyLessonDetail, canonical: string) {
  const description = getLessonMetaDescription(lesson);
  const published = toIsoDateTime(lesson.publishedAt.slice(0, 10));

  const webPage = {
    "@type": "WebPage",
    "@id": canonical,
    name: lesson.title,
    description,
    url: canonical,
    inLanguage: "en-IN",
    isPartOf: {
      "@type": "CollectionPage",
      name: "BidWar Academy",
      url: `${BASE_URL}/academy`,
    },
  };

  const crumbs = breadcrumbSchema([
    { name: "Home", item: `${BASE_URL}/` },
    { name: "Academy", item: `${BASE_URL}/academy` },
    ...(lesson.categoryName && lesson.categorySlug
      ? [{ name: lesson.categoryName, item: `${BASE_URL}/academy?category=${lesson.categorySlug}` }]
      : []),
    { name: lesson.title, item: canonical },
  ]);

  const graph: Record<string, unknown>[] = [webPage, crumbs];

  graph.push({
    "@type": "Article",
    "@id": `${canonical}#article`,
    headline: lesson.title,
    description,
    datePublished: published,
    dateModified: published,
    author: { "@type": "Organization", name: "BidWar", url: BASE_URL },
    publisher: { "@type": "Organization", name: "BidWar", url: BASE_URL },
    mainEntityOfPage: { "@id": canonical },
  });

  if (lesson.youtubeVideoId) {
    graph.push({
      "@type": "VideoObject",
      name: lesson.title,
      description,
      thumbnailUrl: lesson.thumbnailUrl && !lesson.thumbnailUrl.includes("hqdefault.jpg")
        ? lesson.thumbnailUrl
        : `https://img.youtube.com/vi/${lesson.youtubeVideoId}/mqdefault.jpg`,
      uploadDate: published,
      embedUrl: `https://www.youtube.com/embed/${lesson.youtubeVideoId}`,
      contentUrl: lesson.youtubeUrl ?? `https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`,
      publisher: { "@type": "Organization", name: "BidWar", url: BASE_URL },
    });
  }

  return [{ "@context": "https://schema.org", "@graph": graph }];
}

export function isAcademyPublicPath(pathname: string): boolean {
  return pathname === "/academy" || ACADEMY_LESSON_RE.test(pathname);
}

export function parseAcademyLessonSlug(pathname: string): string | null {
  const match = pathname.match(ACADEMY_LESSON_RE);
  return match?.[1] ?? null;
}

export async function resolveAcademyPageMeta(pathname: string): Promise<PageMeta | null> {
  if (pathname === "/academy") {
    return withOg({
      title: "BidWar Academy — Sports Auction Tutorials & Platform Guides",
      description:
        "Free video tutorials and step-by-step guides for running franchise league player auctions with BidWar. Learn auction setup, live bidding, and organiser workflows.",
      canonical: `${BASE_URL}/academy`,
      ogTitle: "BidWar Academy — Sports Auction Tutorials",
      ogDescription:
        "Video tutorials and guides for franchise league organisers using BidWar's live auction platform.",
      schemas: [
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: "BidWar Academy",
              url: `${BASE_URL}/academy`,
              description:
                "Sports auction tutorials and platform walkthroughs for cricket, football, kabaddi and franchise leagues.",
              isPartOf: { "@type": "WebSite", name: "BidWar", url: BASE_URL },
            },
            breadcrumbSchema([
              { name: "Home", item: `${BASE_URL}/` },
              { name: "Academy", item: `${BASE_URL}/academy` },
            ]),
          ],
        },
      ],
    });
  }

  const slug = parseAcademyLessonSlug(pathname);
  if (!slug) return null;

  const data = await fetchAcademyLessonPageData(slug);
  if (!data) return null;

  const lesson = data.lesson;
  const canonical = `${BASE_URL}/academy/${lesson.slug}`;
  const title = getLessonMetaTitle(lesson);
  const description = getLessonMetaDescription(lesson);
  const ogImage =
    (lesson.youtubeVideoId
      ? lesson.thumbnailUrl && !lesson.thumbnailUrl.includes("hqdefault.jpg")
        ? lesson.thumbnailUrl
        : `https://img.youtube.com/vi/${lesson.youtubeVideoId}/mqdefault.jpg`
      : lesson.thumbnailUrl) ?? undefined;

  return withOg({
    title,
    description,
    canonical,
    ogTitle: lesson.title,
    ogDescription: description,
    ogType: "article",
    articlePublishedTime: toIsoDateTime(lesson.publishedAt.slice(0, 10)),
    articleModifiedTime: toIsoDateTime(lesson.publishedAt.slice(0, 10)),
    ...(ogImage ? { ogImage } : {}),
    schemas: buildLessonSchemas(lesson, canonical),
  });
}
