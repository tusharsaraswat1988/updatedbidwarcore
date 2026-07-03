import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { academyCategoriesTable, academyLessonsTable } from "@workspace/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  ACADEMY_CONTENT_FORMATS,
  ACADEMY_LESSON_STATUSES,
  ensureUniqueCategorySlug,
  ensureUniqueLessonSlug,
  extractYoutubeVideoId,
  slugifyAcademyText,
} from "../lib/academy-lesson-utils.js";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.jwtUser?.isAdmin) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authorised" });
}

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

const lessonCreateSchema = z.object({
  episodeNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  shortDescription: z.string().max(500).optional().nullable(),
  content: z.string().max(500_000).optional().nullable(),
  contentFormat: z.enum(ACADEMY_CONTENT_FORMATS).optional(),
  youtubeUrl: z.string().url().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(160).optional().nullable(),
  status: z.enum(ACADEMY_LESSON_STATUSES).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const lessonUpdateSchema = lessonCreateSchema.partial();

async function resolveCategoryId(categoryId: number | null | undefined): Promise<number | null> {
  if (categoryId == null) return null;
  const [cat] = await db
    .select({ id: academyCategoriesTable.id })
    .from(academyCategoriesTable)
    .where(and(eq(academyCategoriesTable.id, categoryId), eq(academyCategoriesTable.active, true)));
  return cat?.id ?? null;
}

async function buildLessonInsertValues(parsed: z.infer<typeof lessonCreateSchema>) {
  const baseSlug = parsed.slug ?? slugifyAcademyText(parsed.title);
  const slug = await ensureUniqueLessonSlug(baseSlug);
  const youtubeVideoId = extractYoutubeVideoId(parsed.youtubeUrl ?? null);
  const categoryId = await resolveCategoryId(parsed.categoryId);

  if (parsed.categoryId != null && categoryId == null) {
    throw new Error("INVALID_CATEGORY");
  }

  return {
    episodeNumber: parsed.episodeNumber,
    title: parsed.title,
    slug,
    shortDescription: parsed.shortDescription ?? null,
    content: parsed.content ?? null,
    contentFormat: parsed.contentFormat ?? "plain",
    youtubeUrl: parsed.youtubeUrl ?? null,
    youtubeVideoId,
    categoryId,
    seoTitle: parsed.seoTitle ?? null,
    seoDescription: parsed.seoDescription ?? null,
    status: parsed.status ?? "draft",
    displayOrder: parsed.displayOrder ?? 0,
  };
}

// ─── Categories ───────────────────────────────────────────────────────────────

router.get("/auth/admin/knowledge-center/academy/categories", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(academyCategoriesTable)
    .orderBy(asc(academyCategoriesTable.displayOrder), asc(academyCategoriesTable.name));
  res.json(rows);
});

router.post("/auth/admin/knowledge-center/academy/categories", requireAdmin, async (req, res) => {
  const parsed = categoryCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const baseSlug = parsed.data.slug ?? slugifyAcademyText(parsed.data.name);
  const slug = await ensureUniqueCategorySlug(baseSlug);

  const [row] = await db
    .insert(academyCategoriesTable)
    .values({
      name: parsed.data.name,
      slug,
      displayOrder: parsed.data.displayOrder ?? 0,
      active: parsed.data.active ?? true,
    })
    .returning();

  res.status(201).json(row);
});

router.patch("/auth/admin/knowledge-center/academy/categories/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = categoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [existing] = await db
    .select()
    .from(academyCategoriesTable)
    .where(eq(academyCategoriesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.displayOrder !== undefined) updates.displayOrder = parsed.data.displayOrder;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.slug !== undefined) {
    updates.slug = await ensureUniqueCategorySlug(parsed.data.slug, id);
  }

  const [row] = await db
    .update(academyCategoriesTable)
    .set(updates)
    .where(eq(academyCategoriesTable.id, id))
    .returning();

  res.json(row);
});

// ─── Lessons ──────────────────────────────────────────────────────────────────

router.get("/auth/admin/knowledge-center/academy/lessons", requireAdmin, async (req, res) => {
  const includeArchived = req.query.includeArchived === "true";

  const conditions = includeArchived ? undefined : ne(academyLessonsTable.status, "archived");

  const rows = await db
    .select({
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
      seoTitle: academyLessonsTable.seoTitle,
      seoDescription: academyLessonsTable.seoDescription,
      status: academyLessonsTable.status,
      displayOrder: academyLessonsTable.displayOrder,
      createdAt: academyLessonsTable.createdAt,
      updatedAt: academyLessonsTable.updatedAt,
    })
    .from(academyLessonsTable)
    .leftJoin(academyCategoriesTable, eq(academyLessonsTable.categoryId, academyCategoriesTable.id))
    .where(conditions)
    .orderBy(asc(academyLessonsTable.displayOrder), asc(academyLessonsTable.episodeNumber));

  res.json(rows);
});

router.get("/auth/admin/knowledge-center/academy/lessons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select({
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
      seoTitle: academyLessonsTable.seoTitle,
      seoDescription: academyLessonsTable.seoDescription,
      status: academyLessonsTable.status,
      displayOrder: academyLessonsTable.displayOrder,
      createdAt: academyLessonsTable.createdAt,
      updatedAt: academyLessonsTable.updatedAt,
    })
    .from(academyLessonsTable)
    .leftJoin(academyCategoriesTable, eq(academyLessonsTable.categoryId, academyCategoriesTable.id))
    .where(eq(academyLessonsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  res.json(row);
});

router.post("/auth/admin/knowledge-center/academy/lessons", requireAdmin, async (req, res) => {
  const parsed = lessonCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const values = await buildLessonInsertValues(parsed.data);
    const [row] = await db.insert(academyLessonsTable).values(values).returning();
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_CATEGORY") {
      res.status(400).json({ error: "Invalid or inactive category" });
      return;
    }
    const code = (e as { code?: string }).code;
    if (code === "23505") {
      res.status(409).json({ error: "Episode number or slug already exists" });
      return;
    }
    throw e;
  }
});

router.patch("/auth/admin/knowledge-center/academy/lessons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = lessonUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [existing] = await db
    .select()
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (parsed.data.episodeNumber !== undefined) updates.episodeNumber = parsed.data.episodeNumber;
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.shortDescription !== undefined) updates.shortDescription = parsed.data.shortDescription;
  if (parsed.data.content !== undefined) updates.content = parsed.data.content;
  if (parsed.data.contentFormat !== undefined) updates.contentFormat = parsed.data.contentFormat;
  if (parsed.data.seoTitle !== undefined) updates.seoTitle = parsed.data.seoTitle;
  if (parsed.data.seoDescription !== undefined) updates.seoDescription = parsed.data.seoDescription;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.displayOrder !== undefined) updates.displayOrder = parsed.data.displayOrder;

  if (parsed.data.slug !== undefined) {
    updates.slug = await ensureUniqueLessonSlug(parsed.data.slug, id);
  }

  if (parsed.data.youtubeUrl !== undefined) {
    updates.youtubeUrl = parsed.data.youtubeUrl;
    updates.youtubeVideoId = extractYoutubeVideoId(parsed.data.youtubeUrl);
  }

  if (parsed.data.categoryId !== undefined) {
    const categoryId = await resolveCategoryId(parsed.data.categoryId);
    if (parsed.data.categoryId != null && categoryId == null) {
      res.status(400).json({ error: "Invalid or inactive category" });
      return;
    }
    updates.categoryId = categoryId;
  }

  try {
    const [row] = await db
      .update(academyLessonsTable)
      .set(updates)
      .where(eq(academyLessonsTable.id, id))
      .returning();
    res.json(row);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23505") {
      res.status(409).json({ error: "Episode number or slug already exists" });
      return;
    }
    throw e;
  }
});

/** Soft-delete: sets status to archived instead of removing the row. */
router.delete("/auth/admin/knowledge-center/academy/lessons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select({ id: academyLessonsTable.id, status: academyLessonsTable.status })
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  if (existing.status === "archived") {
    res.status(204).end();
    return;
  }

  await db
    .update(academyLessonsTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(academyLessonsTable.id, id));

  res.status(204).end();
});

/** Suggest next episode number for new lessons. */
router.get("/auth/admin/knowledge-center/academy/lessons-meta/next-episode", requireAdmin, async (_req, res) => {
  const [result] = await db
    .select({ max: sql<number>`coalesce(max(${academyLessonsTable.episodeNumber}), 0)` })
    .from(academyLessonsTable)
    .where(ne(academyLessonsTable.status, "archived"));

  res.json({ nextEpisodeNumber: (result?.max ?? 0) + 1 });
});

router.post("/auth/admin/knowledge-center/academy/lessons/:id/duplicate", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [source] = await db.select().from(academyLessonsTable).where(eq(academyLessonsTable.id, id));
  if (!source) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  const [epRow] = await db
    .select({ max: sql<number>`coalesce(max(${academyLessonsTable.episodeNumber}), 0)` })
    .from(academyLessonsTable)
    .where(ne(academyLessonsTable.status, "archived"));

  const slug = await ensureUniqueLessonSlug(`${source.slug}-copy`);
  const episodeNumber = (epRow?.max ?? 0) + 1;

  const [row] = await db
    .insert(academyLessonsTable)
    .values({
      episodeNumber,
      title: `${source.title} (Copy)`,
      slug,
      shortDescription: source.shortDescription,
      content: source.content,
      contentFormat: source.contentFormat,
      youtubeUrl: source.youtubeUrl,
      youtubeVideoId: source.youtubeVideoId,
      categoryId: source.categoryId,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      status: "draft",
      displayOrder: source.displayOrder,
    })
    .returning();

  res.status(201).json(row);
});

export default router;
