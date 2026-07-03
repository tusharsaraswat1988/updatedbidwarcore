import { escapeHtml } from "./academy-lesson-helpers.js";
import type { PublicAcademyPageData } from "./academy-public-service.js";

function heroImageUrl(lesson: {
  youtubeVideoId?: string | null;
  thumbnailUrl?: string | null;
}): string | null {
  if (lesson.thumbnailUrl) return lesson.thumbnailUrl;
  if (lesson.youtubeVideoId) {
    return `https://img.youtube.com/vi/${lesson.youtubeVideoId}/mqdefault.jpg`;
  }
  return null;
}

/** Resource hints injected into the HTML head for academy routes. */
export function buildAcademyHeadHints(data: PublicAcademyPageData): string {
  const hints: string[] = [];

  if (data.page === "index") {
    const featured = data.featuredLessons[0] ?? data.lessons[0];
    const heroUrl = featured ? heroImageUrl(featured) : null;
    if (heroUrl) {
      hints.push(
        `<link rel="preload" as="image" href="${escapeHtml(heroUrl)}" fetchpriority="high" />`,
      );
    }
    if (featured?.youtubeVideoId && !featured.thumbnailUrl) {
      hints.push('<link rel="preconnect" href="https://i.ytimg.com" crossorigin />');
    }
  } else {
    const heroUrl = heroImageUrl(data.lesson);
    if (heroUrl) {
      hints.push(
        `<link rel="preload" as="image" href="${escapeHtml(heroUrl)}" fetchpriority="high" />`,
      );
    }
    if (data.lesson.youtubeVideoId) {
      hints.push('<link rel="preconnect" href="https://i.ytimg.com" crossorigin />');
      hints.push('<link rel="dns-prefetch" href="https://www.youtube.com" />');
    }
  }

  const thumbHosts = new Set<string>();
  const lessons =
    data.page === "index"
      ? [...data.featuredLessons, ...data.latestLessons, ...data.lessons]
      : [data.lesson];
  for (const lesson of lessons) {
    const url = lesson.thumbnailUrl;
    if (url?.includes("res.cloudinary.com")) {
      thumbHosts.add("https://res.cloudinary.com");
    }
  }
  for (const host of thumbHosts) {
    hints.push(`<link rel="dns-prefetch" href="${host}" />`);
  }

  return hints.join("\n    ");
}

/** Strip non-critical font preloads for academy (Inter only is preloaded in shell). */
export function trimAcademyFontPreloads(html: string): string {
  return html.replace(
    /\s*<link rel="preload" href="\/fonts\/space-grotesk[^"]+"[^>]*>/g,
    "",
  );
}
