import { db } from "@workspace/db";
import { academyCategoriesTable, academyLessonsTable } from "@workspace/db/schema";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  estimateLessonDurationMinutes,
  extractTopicsFromContent,
  stripContentForDescription,
  youtubeThumbnailUrl,
  deriveCategoriesFromLessons,
  type AcademyContentFormat,
} from "./academy-lesson-helpers.js";

const PUBLISHED = eq(academyLessonsTable.status, "published");

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

const lessonSummarySelect = {
  id: academyLessonsTable.id,
  episodeNumber: academyLessonsTable.episodeNumber,
  title: academyLessonsTable.title,
  slug: academyLessonsTable.slug,
  shortDescription: academyLessonsTable.shortDescription,
  content: academyLessonsTable.content,
  contentFormat: academyLessonsTable.contentFormat,
  youtubeUrl: academyLessonsTable.youtubeUrl,
  youtubeVideoId: academyLessonsTable.youtubeVideoId,
  categoryId: academyLessonsTable.categoryId,
  categoryName: academyCategoriesTable.name,
  categorySlug: academyCategoriesTable.slug,
  seoTitle: academyLessonsTable.seoTitle,
  seoDescription: academyLessonsTable.seoDescription,
  displayOrder: academyLessonsTable.displayOrder,
  publishedAt: academyLessonsTable.updatedAt,
};

function mapSummary(row: {
  id: number;
  episodeNumber: number;
  title: string;
  slug: string;
  shortDescription: string | null;
  content: string | null;
  contentFormat: string;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  displayOrder: number;
  publishedAt: Date;
}): PublicAcademyLessonSummary {
  const contentFormat = (row.contentFormat ?? "plain") as AcademyContentFormat;
  return {
    id: row.id,
    episodeNumber: row.episodeNumber,
    title: row.title,
    slug: row.slug,
    shortDescription: row.shortDescription,
    contentFormat,
    youtubeUrl: row.youtubeUrl,
    youtubeVideoId: row.youtubeVideoId,
    thumbnailUrl: youtubeThumbnailUrl(row.youtubeVideoId),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    displayOrder: row.displayOrder,
    durationMinutes: estimateLessonDurationMinutes(row.content, !!row.youtubeVideoId),
    publishedAt: row.publishedAt.toISOString(),
  };
}

function mapNav(row: { slug: string; title: string; episodeNumber: number }): PublicAcademyLessonNav {
  return { slug: row.slug, title: row.title, episodeNumber: row.episodeNumber };
}

export async function listPublishedAcademyLessons(search?: string, categorySlug?: string): Promise<PublicAcademyLessonSummary[]> {
  const conditions = [PUBLISHED];

  if (categorySlug) {
    conditions.push(eq(academyCategoriesTable.slug, categorySlug));
    conditions.push(eq(academyCategoriesTable.active, true));
  }

  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(academyLessonsTable.title, q),
        ilike(academyLessonsTable.shortDescription, q),
        ilike(academyLessonsTable.content, q),
        sql`cast(${academyLessonsTable.episodeNumber} as text) ilike ${q}`,
        ilike(academyCategoriesTable.name, q),
      )!,
    );
  }

  const rows = await db
    .select(lessonSummarySelect)
    .from(academyLessonsTable)
    .leftJoin(academyCategoriesTable, eq(academyLessonsTable.categoryId, academyCategoriesTable.id))
    .where(and(...conditions))
    .orderBy(asc(academyLessonsTable.displayOrder), asc(academyLessonsTable.episodeNumber));

  return rows.map(mapSummary);
}

export async function listPublishedAcademyCategories(): Promise<PublicAcademyCategory[]> {
  const lessons = await listPublishedAcademyLessons();
  return deriveCategoriesFromLessons(lessons);
}

async function listPublishedNavLessons(): Promise<Array<{ id: number; slug: string; title: string; episodeNumber: number; categoryId: number | null }>> {
  return db
    .select({
      id: academyLessonsTable.id,
      slug: academyLessonsTable.slug,
      title: academyLessonsTable.title,
      episodeNumber: academyLessonsTable.episodeNumber,
      categoryId: academyLessonsTable.categoryId,
    })
    .from(academyLessonsTable)
    .where(PUBLISHED)
    .orderBy(asc(academyLessonsTable.episodeNumber));
}

export async function getPublishedAcademyLessonBySlug(slug: string): Promise<PublicAcademyLessonDetail | null> {
  const [row] = await db
    .select(lessonSummarySelect)
    .from(academyLessonsTable)
    .leftJoin(academyCategoriesTable, eq(academyLessonsTable.categoryId, academyCategoriesTable.id))
    .where(and(PUBLISHED, eq(academyLessonsTable.slug, slug)))
    .limit(1);

  if (!row) return null;

  const navLessons = await listPublishedNavLessons();
  const idx = navLessons.findIndex((l) => l.slug === slug);
  const previousLesson = idx > 0 ? mapNav(navLessons[idx - 1]!) : null;
  const nextLesson = idx >= 0 && idx < navLessons.length - 1 ? mapNav(navLessons[idx + 1]!) : null;

  const relatedRows = navLessons
    .filter((l) => l.slug !== slug && row.categoryId != null && l.categoryId === row.categoryId)
    .slice(0, 3)
    .map(mapNav);

  if (relatedRows.length < 3) {
    const filler = navLessons
      .filter((l) => l.slug !== slug && !relatedRows.some((r) => r.slug === l.slug))
      .slice(0, 3 - relatedRows.length)
      .map(mapNav);
    relatedRows.push(...filler);
  }

  const contentFormat = (row.contentFormat ?? "plain") as AcademyContentFormat;

  return {
    ...mapSummary(row),
    content: row.content,
    topics: extractTopicsFromContent(row.content, contentFormat),
    previousLesson,
    nextLesson,
    relatedLessons: relatedRows,
  };
}

export async function fetchAcademyIndexPageData(): Promise<PublicAcademyIndexData> {
  const lessons = await listPublishedAcademyLessons();
  const categories = deriveCategoriesFromLessons(lessons);

  const featuredLessons = [...lessons]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.episodeNumber - b.episodeNumber)
    .slice(0, 3);

  const latestLessons = [...lessons]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 6);

  return {
    page: "index",
    lessons,
    categories,
    featuredLessons,
    latestLessons,
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchAcademyLessonPageData(slug: string): Promise<PublicAcademyLessonPageData | null> {
  const lesson = await getPublishedAcademyLessonBySlug(slug);
  if (!lesson) return null;
  return { page: "lesson", lesson, generatedAt: new Date().toISOString() };
}

export async function listPublishedAcademySitemapEntries(): Promise<Array<{ loc: string; lastmod: string }>> {
  const rows = await db
    .select({
      slug: academyLessonsTable.slug,
      updatedAt: academyLessonsTable.updatedAt,
    })
    .from(academyLessonsTable)
    .where(PUBLISHED)
    .orderBy(asc(academyLessonsTable.episodeNumber));

  const BASE = "https://bidwar.in";
  return rows.map((r) => ({
    loc: `${BASE}/academy/${r.slug}`,
    lastmod: r.updatedAt.toISOString().slice(0, 10),
  }));
}

export function getLessonMetaDescription(lesson: PublicAcademyLessonSummary & { content?: string | null }): string {
  return (
    lesson.seoDescription?.trim() ||
    lesson.shortDescription?.trim() ||
    stripContentForDescription(lesson.content ?? null, lesson.contentFormat)
  );
}

export function getLessonMetaTitle(lesson: PublicAcademyLessonSummary): string {
  return lesson.seoTitle?.trim() || `${lesson.title} — BidWar Academy`;
}
