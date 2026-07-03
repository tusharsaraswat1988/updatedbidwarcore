import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** CMS categories for Knowledge Center → Academy lessons. */
export const academyCategoriesTable = pgTable(
  "academy_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_academy_categories_slug").on(t.slug),
    index("ix_academy_categories_active").on(t.active),
    index("ix_academy_categories_display_order").on(t.displayOrder),
  ],
);

/**
 * Academy lesson CMS records.
 * `content` stores the body (plain text, markdown, or HTML).
 * `contentFormat` tells renderers how to interpret `content` — no schema change needed when adding a rich editor.
 */
export const academyLessonsTable = pgTable(
  "academy_lessons",
  {
    id: serial("id").primaryKey(),
    episodeNumber: integer("episode_number").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description"),
    /** Body storage — format determined by contentFormat. */
    content: text("content"),
    /** plain | markdown | html */
    contentFormat: text("content_format").notNull().default("plain"),
    youtubeUrl: text("youtube_url"),
    youtubeVideoId: text("youtube_video_id"),
    categoryId: integer("category_id"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** draft | published | archived */
    status: text("status").notNull().default("draft"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_academy_lessons_slug").on(t.slug),
    uniqueIndex("uq_academy_lessons_episode_number").on(t.episodeNumber),
    index("ix_academy_lessons_status").on(t.status),
    index("ix_academy_lessons_category_id").on(t.categoryId),
    index("ix_academy_lessons_display_order").on(t.displayOrder),
  ],
);

export const insertAcademyCategorySchema = createInsertSchema(academyCategoriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAcademyLessonSchema = createInsertSchema(academyLessonsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AcademyCategory = typeof academyCategoriesTable.$inferSelect;
export type InsertAcademyCategory = z.infer<typeof insertAcademyCategorySchema>;
export type AcademyLesson = typeof academyLessonsTable.$inferSelect;
export type InsertAcademyLesson = z.infer<typeof insertAcademyLessonSchema>;
