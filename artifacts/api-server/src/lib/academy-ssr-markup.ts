import { escapeHtml } from "./academy-lesson-helpers.js";
import type {
  PublicAcademyIndexData,
  PublicAcademyLessonDetail,
  PublicAcademyLessonSummary,
} from "./academy-public-service.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function youtubeThumb16x9(lesson: {
  youtubeVideoId?: string | null;
  thumbnailUrl?: string | null;
}): string | null {
  if (lesson.youtubeVideoId) {
    if (
      lesson.thumbnailUrl &&
      !lesson.thumbnailUrl.includes("hqdefault.jpg") &&
      !lesson.thumbnailUrl.includes("default.jpg")
    ) {
      return lesson.thumbnailUrl;
    }
    return `https://img.youtube.com/vi/${lesson.youtubeVideoId}/mqdefault.jpg`;
  }
  return lesson.thumbnailUrl ?? null;
}

function lessonCardHtml(
  lesson: PublicAcademyLessonSummary,
  imagePriority: "hero" | "lazy" = "lazy",
): string {
  const thumbUrl = youtubeThumb16x9(lesson);
  const imgAttrs =
    imagePriority === "hero"
      ? `width="1280" height="720" fetchpriority="high" decoding="async"`
      : `width="320" height="180" loading="lazy" decoding="async"`;
  const thumb = thumbUrl
    ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(lesson.title)}" ${imgAttrs} />`
    : `<div class="academy-ssr-thumb-placeholder">Ep ${lesson.episodeNumber}</div>`;

  return `<article class="academy-ssr-card">
    <a href="/academy/${escapeHtml(lesson.slug)}">
      ${thumb}
      <p class="academy-ssr-ep">Episode ${lesson.episodeNumber}</p>
      <h3>${escapeHtml(lesson.title)}</h3>
      ${lesson.categoryName ? `<p class="academy-ssr-cat">${escapeHtml(lesson.categoryName)}</p>` : ""}
      <p class="academy-ssr-meta">${lesson.durationMinutes} min · ${formatDate(lesson.publishedAt)}</p>
      ${lesson.shortDescription ? `<p class="academy-ssr-desc">${escapeHtml(lesson.shortDescription)}</p>` : ""}
      <span>Watch Tutorial</span>
    </a>
  </article>`;
}

function featuredHeroHtml(lesson: PublicAcademyLessonSummary): string {
  const card = lessonCardHtml(lesson, "hero");
  return `<section class="academy-ssr-featured"><h2>Featured Tutorial</h2>${card}</section>`;
}

export function buildAcademyIndexMarkup(data: PublicAcademyIndexData): string {
  const featured = data.featuredLessons.length
    ? featuredHeroHtml(data.featuredLessons[0]!)
    : "";
  const latest = data.latestLessons.map((l) => lessonCardHtml(l)).join("\n");
  const all = data.lessons.map((l) => lessonCardHtml(l)).join("\n");
  const categories = data.categories
    .map((c) => `<li><a href="/academy?category=${escapeHtml(c.slug)}">${escapeHtml(c.name)} (${c.lessonCount})</a></li>`)
    .join("\n");

  return `<main class="academy-ssr" id="academy-ssr-content">
  <header>
    <nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li>Academy</li></ol></nav>
    <h1>BidWar Academy — Sports Auction Tutorials</h1>
    <p>Free video tutorials and step-by-step guides for franchise league organisers running live player auctions with BidWar.</p>
  </header>
  ${data.categories.length ? `<section><h2>Categories</h2><ul>${categories}</ul></section>` : ""}
  ${featured ? featured : ""}
  ${data.latestLessons.length ? `<section><h2>Latest Tutorials</h2><div class="academy-ssr-grid">${latest}</div></section>` : ""}
  ${data.lessons.length ? `<section><h2>All Tutorials</h2><div class="academy-ssr-grid">${all}</div></section>` : ""}
</main>`;
}

function renderPlainContent(content: string): string {
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join("\n");
}

export function buildAcademyLessonMarkup(lesson: PublicAcademyLessonDetail): string {
  const crumbs = [
    `<li><a href="/">Home</a></li>`,
    `<li><a href="/academy">Academy</a></li>`,
    ...(lesson.categoryName ? [`<li>${escapeHtml(lesson.categoryName)}</li>`] : []),
    `<li>${escapeHtml(lesson.title)}</li>`,
  ].join("");

  const topics = lesson.topics.length
    ? `<section><h2>Topics Covered</h2><ul>${lesson.topics.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></section>`
    : "";

  const body =
    lesson.contentFormat === "html" && lesson.content
      ? lesson.content
      : lesson.content
        ? renderPlainContent(lesson.content)
        : lesson.shortDescription
          ? `<p>${escapeHtml(lesson.shortDescription)}</p>`
          : "";

  const prev = lesson.previousLesson
    ? `<a href="/academy/${escapeHtml(lesson.previousLesson.slug)}">← Ep ${lesson.previousLesson.episodeNumber}: ${escapeHtml(lesson.previousLesson.title)}</a>`
    : "";
  const next = lesson.nextLesson
    ? `<a href="/academy/${escapeHtml(lesson.nextLesson.slug)}">Ep ${lesson.nextLesson.episodeNumber}: ${escapeHtml(lesson.nextLesson.title)} →</a>`
    : "";

  const related = lesson.relatedLessons.length
    ? `<section><h2>Related Lessons</h2><ul>${lesson.relatedLessons
        .map((r) => `<li><a href="/academy/${escapeHtml(r.slug)}">Ep ${r.episodeNumber}: ${escapeHtml(r.title)}</a></li>`)
        .join("")}</ul></section>`
    : "";

  const heroThumb = youtubeThumb16x9(lesson);
  const heroVideo = heroThumb
    ? `<figure class="academy-ssr-featured"><img src="${escapeHtml(heroThumb)}" alt="${escapeHtml(lesson.title)}" width="1280" height="720" fetchpriority="high" decoding="async" /></figure>`
    : "";

  return `<main class="academy-ssr" id="academy-ssr-content">
  <nav aria-label="Breadcrumb"><ol>${crumbs}</ol></nav>
  <p class="academy-ssr-ep">Episode ${lesson.episodeNumber}</p>
  <h1>${escapeHtml(lesson.title)}</h1>
  ${lesson.categoryName ? `<p class="academy-ssr-cat">${escapeHtml(lesson.categoryName)}</p>` : ""}
  <p class="academy-ssr-meta">${lesson.durationMinutes} min · Published ${formatDate(lesson.publishedAt)}</p>
  ${heroVideo}
  <section><h2>Lesson Description</h2>${body}</section>
  ${topics}
  <nav class="academy-ssr-nav">${prev} ${next}</nav>
  ${related}
  <p><a href="/contact">Get started with BidWar</a></p>
</main>`;
}
