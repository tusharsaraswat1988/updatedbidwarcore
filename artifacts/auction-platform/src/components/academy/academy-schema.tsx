import { useBranding } from "@/hooks/use-branding";
import { getOrganizationLogoUrl } from "@/lib/brand-assets";
import {
  formatAcademyDate,
  getLessonDescription,
  type PublicAcademyLessonDetail,
  type PublicAcademyLessonSummary,
} from "@/lib/academy-public";

const BASE = "https://bidwar.in";

interface AcademyLessonSchemaProps {
  lesson: PublicAcademyLessonDetail;
}

export function AcademyLessonSchema({ lesson }: AcademyLessonSchemaProps) {
  const { iconVersion } = useBranding();
  const brandLogoUrl = getOrganizationLogoUrl(iconVersion);
  const canonical = `${BASE}/academy/${lesson.slug}`;
  const description = getLessonDescription(lesson);

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": canonical,
    name: lesson.title,
    description,
    url: canonical,
    inLanguage: "en-IN",
    isPartOf: { "@type": "CollectionPage", name: "BidWar Academy", url: `${BASE}/academy` },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Academy", item: `${BASE}/academy` },
      ...(lesson.categoryName
        ? [{ "@type": "ListItem", position: 3, name: lesson.categoryName, item: `${BASE}/academy?category=${lesson.categorySlug}` }]
        : []),
      {
        "@type": "ListItem",
        position: lesson.categoryName ? 4 : 3,
        name: lesson.title,
        item: canonical,
      },
    ],
  };

  const video = lesson.youtubeVideoId
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: lesson.title,
        description,
        thumbnailUrl: lesson.thumbnailUrl ?? `https://img.youtube.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`,
        uploadDate: lesson.publishedAt.slice(0, 10),
        embedUrl: `https://www.youtube.com/embed/${lesson.youtubeVideoId}`,
        contentUrl: lesson.youtubeUrl ?? `https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`,
        publisher: {
          "@type": "Organization",
          name: "BidWar",
          url: BASE,
          logo: { "@type": "ImageObject", url: brandLogoUrl },
        },
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {video && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(video) }} />
      )}
    </>
  );
}

export function AcademyListingSchema({ lessons }: { lessons: PublicAcademyLessonSummary[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "BidWar Academy",
    url: `${BASE}/academy`,
    description: "Sports auction video tutorials and platform guides from BidWar.",
    hasPart: lessons.map((l) => ({
      "@type": "WebPage",
      name: l.title,
      url: `${BASE}/academy/${l.slug}`,
    })),
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}
