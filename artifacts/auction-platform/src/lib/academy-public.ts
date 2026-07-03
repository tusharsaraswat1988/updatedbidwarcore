import { apiFetch } from "@workspace/api-base";

export type AcademyContentFormat = "plain" | "markdown" | "html";

export type PublicAcademyCategory = {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
  lessonCount: number;
};

export type PublicAcademyLessonSummary = {
  id: number;
  episodeNumber: number;
  title: string;
  slug: string;
  shortDescription: string | null;
  contentFormat: AcademyContentFormat;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  thumbnailUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  displayOrder: number;
  durationMinutes: number;
  publishedAt: string;
};

export type PublicAcademyLessonNav = {
  slug: string;
  title: string;
  episodeNumber: number;
};

export type PublicAcademyLessonDetail = PublicAcademyLessonSummary & {
  content: string | null;
  topics: string[];
  previousLesson: PublicAcademyLessonNav | null;
  nextLesson: PublicAcademyLessonNav | null;
  relatedLessons: PublicAcademyLessonNav[];
};

export type PublicAcademyIndexData = {
  page: "index";
  lessons: PublicAcademyLessonSummary[];
  categories: PublicAcademyCategory[];
  featuredLessons: PublicAcademyLessonSummary[];
  latestLessons: PublicAcademyLessonSummary[];
  generatedAt: string;
};

export type PublicAcademyLessonPageData = {
  page: "lesson";
  lesson: PublicAcademyLessonDetail;
  generatedAt: string;
};

export type PublicAcademyPageData = PublicAcademyIndexData | PublicAcademyLessonPageData;

declare global {
  interface Window {
    __BIDWAR_ACADEMY_DATA__?: PublicAcademyPageData;
  }
}

export function readWindowAcademyData(): PublicAcademyPageData | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__BIDWAR_ACADEMY_DATA__;
}

export async function fetchAcademyIndex(): Promise<PublicAcademyIndexData | null> {
  try {
    const r = await apiFetch("/academy");
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export async function fetchAcademyLessons(search?: string, category?: string): Promise<PublicAcademyLessonSummary[]> {
  try {
    const params = new URLSearchParams();
    if (search?.trim()) params.set("search", search.trim());
    if (category?.trim()) params.set("category", category.trim());
    const q = params.toString();
    const r = await apiFetch(`/academy/lessons${q ? `?${q}` : ""}`);
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

export async function fetchAcademyLesson(slug: string): Promise<PublicAcademyLessonDetail | null> {
  try {
    const r = await apiFetch(`/academy/lessons/${encodeURIComponent(slug)}`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export function deriveCategoriesFromLessons(
  lessons: PublicAcademyLessonSummary[],
): PublicAcademyCategory[] {
  const bySlug = new Map<
    string,
    PublicAcademyCategory & { minDisplayOrder: number }
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

export function filterLessonsClientSide(
  lessons: PublicAcademyLessonSummary[],
  search: string,
  categorySlug: string | null,
): PublicAcademyLessonSummary[] {
  const q = search.trim().toLowerCase();
  return lessons.filter((lesson) => {
    if (categorySlug && lesson.categorySlug !== categorySlug) return false;
    if (!q) return true;
    return (
      lesson.title.toLowerCase().includes(q) ||
      lesson.slug.toLowerCase().includes(q) ||
      String(lesson.episodeNumber).includes(q) ||
      (lesson.categoryName ?? "").toLowerCase().includes(q) ||
      (lesson.shortDescription ?? "").toLowerCase().includes(q)
    );
  });
}

export function formatAcademyDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  return `${minutes} min`;
}

export function getLessonDescription(lesson: PublicAcademyLessonSummary): string {
  return lesson.seoDescription?.trim() || lesson.shortDescription?.trim() || "";
}

export function getLessonTitle(lesson: PublicAcademyLessonSummary): string {
  return lesson.seoTitle?.trim() || lesson.title;
}
