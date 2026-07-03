/** Shared helpers for public academy lesson presentation (server + SSR markup). */

export type AcademyContentFormat = "plain" | "markdown" | "html";

export function youtubeThumbnailUrl(videoId: string | null | undefined): string | null {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function estimateLessonDurationMinutes(content: string | null, hasVideo: boolean): number {
  const words = (content ?? "").split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.ceil(words / 200));
  return hasVideo ? Math.max(readMin, 5) : readMin;
}

export function extractTopicsFromContent(
  content: string | null,
  format: AcademyContentFormat,
  limit = 8,
): string[] {
  if (!content?.trim()) return [];

  const topics: string[] = [];

  if (format === "markdown") {
    for (const line of content.split("\n")) {
      const h = line.match(/^#{1,3}\s+(.+)$/);
      if (h?.[1]) topics.push(h[1].trim());
    }
  } else if (format === "html") {
    for (const m of content.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi)) {
      if (m[1]) topics.push(m[1].trim());
    }
  } else {
    for (const line of content.split("\n")) {
      const bullet = line.match(/^[-*•]\s+(.+)$/);
      if (bullet?.[1]) topics.push(bullet[1].trim());
    }
  }

  return [...new Set(topics)].slice(0, limit);
}

export function stripContentForDescription(content: string | null, format: AcademyContentFormat, maxLen = 320): string {
  if (!content?.trim()) return "";
  let text = content;
  if (format === "html") {
    text = content.replace(/<[^>]+>/g, " ");
  }
  text = text.replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type AcademyLessonCategorySource = {
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  displayOrder: number;
};

export type DerivedAcademyCategory = {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
  lessonCount: number;
};

/** Build browse-by-category chips from published lessons (no hardcoded category list). */
export function deriveCategoriesFromLessons(
  lessons: AcademyLessonCategorySource[],
): DerivedAcademyCategory[] {
  const bySlug = new Map<
    string,
    DerivedAcademyCategory & { minDisplayOrder: number }
  >();

  for (const lesson of lessons) {
    if (!lesson.categorySlug || !lesson.categoryName || lesson.categoryId == null) continue;

    const existing = bySlug.get(lesson.categorySlug);
    if (existing) {
      existing.lessonCount += 1;
      existing.minDisplayOrder = Math.min(existing.minDisplayOrder, lesson.displayOrder);
    } else {
      bySlug.set(lesson.categorySlug, {
        id: lesson.categoryId,
        name: lesson.categoryName,
        slug: lesson.categorySlug,
        displayOrder: lesson.displayOrder,
        lessonCount: 1,
        minDisplayOrder: lesson.displayOrder,
      });
    }
  }

  return [...bySlug.values()]
    .map(({ minDisplayOrder, ...category }) => ({
      ...category,
      displayOrder: minDisplayOrder,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}
