import { useEffect } from "react";
import type { PublicAcademyLessonDetail } from "@/lib/academy-public";

const BASE = "https://bidwar.in";
const SYNC_ID = "academy-jsonld-sync";

function buildLessonGraph(lesson: PublicAcademyLessonDetail, brandLogoUrl: string) {
  const canonical = `${BASE}/academy/${lesson.slug}`;
  const description =
    lesson.seoDescription?.trim() ||
    lesson.shortDescription?.trim() ||
    `Episode ${lesson.episodeNumber} tutorial from BidWar Academy.`;
  const published = lesson.publishedAt.slice(0, 10);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": canonical,
      name: lesson.title,
      description,
      url: canonical,
      inLanguage: "en-IN",
      isPartOf: { "@type": "CollectionPage", name: "BidWar Academy", url: `${BASE}/academy` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: "Academy", item: `${BASE}/academy` },
        ...(lesson.categoryName
          ? [{
              "@type": "ListItem",
              position: 3,
              name: lesson.categoryName,
              item: `${BASE}/academy?category=${lesson.categorySlug}`,
            }]
          : []),
        {
          "@type": "ListItem",
          position: lesson.categoryName ? 4 : 3,
          name: lesson.title,
          item: canonical,
        },
      ],
    },
    {
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: lesson.title,
      description,
      datePublished: published,
      dateModified: published,
      author: { "@type": "Organization", name: "BidWar", url: BASE },
      publisher: {
        "@type": "Organization",
        name: "BidWar",
        url: BASE,
        logo: { "@type": "ImageObject", url: brandLogoUrl },
      },
      mainEntityOfPage: { "@id": canonical },
    },
  ];

  if (lesson.youtubeVideoId) {
    graph.push({
      "@type": "VideoObject",
      name: lesson.title,
      description,
      thumbnailUrl:
        lesson.thumbnailUrl ?? `https://img.youtube.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`,
      uploadDate: published,
      embedUrl: `https://www.youtube.com/embed/${lesson.youtubeVideoId}`,
      contentUrl: lesson.youtubeUrl ?? `https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`,
      publisher: { "@type": "Organization", name: "BidWar", url: BASE },
    });
  }

  return [{ "@context": "https://schema.org", "@graph": graph }];
}

/** Sync JSON-LD on client navigations without duplicating server-injected schema blocks. */
export function useAcademyLessonJsonLd(lesson: PublicAcademyLessonDetail | null, brandLogoUrl: string) {
  useEffect(() => {
    if (!lesson) return;

    let el = document.getElementById(SYNC_ID) as HTMLScriptElement | null;

    document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
      if (node.id !== SYNC_ID) node.remove();
    });

    if (!el) {
      el = document.createElement("script");
      el.id = SYNC_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(buildLessonGraph(lesson, brandLogoUrl)[0]);

    return () => {
      document.getElementById(SYNC_ID)?.remove();
    };
  }, [lesson, brandLogoUrl, lesson?.slug]);
}
