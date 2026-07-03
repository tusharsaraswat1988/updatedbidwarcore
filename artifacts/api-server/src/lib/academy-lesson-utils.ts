import { db } from "@workspace/db";
import { academyCategoriesTable, academyLessonsTable } from "@workspace/db/schema";
import { and, eq, ne } from "drizzle-orm";

export function slugifyAcademyText(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lesson"
  );
}

/** Extract YouTube video ID from common URL formats. */
export function extractYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const embedMatch = parsed.pathname.match(/\/embed\/([\w-]{11})/);
      if (embedMatch) return embedMatch[1];

      const shortsMatch = parsed.pathname.match(/\/shorts\/([\w-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export async function ensureUniqueLessonSlug(
  baseSlug: string,
  excludeId?: number,
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const conditions = [eq(academyLessonsTable.slug, candidate)];
    if (excludeId != null) {
      conditions.push(ne(academyLessonsTable.id, excludeId));
    }

    const [existing] = await db
      .select({ id: academyLessonsTable.id })
      .from(academyLessonsTable)
      .where(and(...conditions))
      .limit(1);

    if (!existing) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function ensureUniqueCategorySlug(
  baseSlug: string,
  excludeId?: number,
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const conditions = [eq(academyCategoriesTable.slug, candidate)];
    if (excludeId != null) {
      conditions.push(ne(academyCategoriesTable.id, excludeId));
    }

    const [existing] = await db
      .select({ id: academyCategoriesTable.id })
      .from(academyCategoriesTable)
      .where(and(...conditions))
      .limit(1);

    if (!existing) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export const ACADEMY_LESSON_STATUSES = ["draft", "published", "archived"] as const;
export type AcademyLessonStatus = (typeof ACADEMY_LESSON_STATUSES)[number];

export const ACADEMY_CONTENT_FORMATS = ["plain", "markdown", "html"] as const;
export type AcademyContentFormat = (typeof ACADEMY_CONTENT_FORMATS)[number];
