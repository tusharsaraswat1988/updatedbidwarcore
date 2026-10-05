import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";

export const bplEditionStatusEnum = [
  "DRAFT",
  "UPCOMING",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type BplEditionStatus = (typeof bplEditionStatusEnum)[number];

export const bplEditionsTable = pgTable(
  "bpl_editions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    editionNumber: integer("edition_number").notNull(),
    slug: text("slug").notNull(),
    year: integer("year").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    venue: text("venue"),
    city: text("city"),
    description: text("description"),
    status: text("status").notNull().default("DRAFT").$type<BplEditionStatus>(),
    linkedTournamentId: integer("linked_tournament_id").references(
      () => tournamentsTable.id,
      { onDelete: "set null" },
    ),
    liveStreamUrl: text("live_stream_url"),
    fanPageUrl: text("fan_page_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("ix_bpl_editions_edition_number").on(t.editionNumber),
    uniqueIndex("ix_bpl_editions_slug").on(t.slug),
    uniqueIndex("ix_bpl_editions_single_live")
      .on(t.status)
      .where(sql`status = 'LIVE'`),
    index("ix_bpl_editions_linked_tournament_id").on(t.linkedTournamentId),
  ],
);

export const insertBplEditionSchema = createInsertSchema(bplEditionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BplEdition = typeof bplEditionsTable.$inferSelect;
export type InsertBplEdition = z.infer<typeof insertBplEditionSchema>;

// ─── BPL Edition Sponsors (P1.8) ─────────────────────────────────────────────

export const bplSponsorCategoryEnum = [
  "TITLE",
  "POWERED_BY",
  "ASSOCIATE",
  "PARTNER",
  "MEDIA_PARTNER",
] as const;

export type BplSponsorCategory = (typeof bplSponsorCategoryEnum)[number];

export const bplEditionSponsorsTable = pgTable(
  "bpl_edition_sponsors",
  {
    id: serial("id").primaryKey(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => bplEditionsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    logoUrl: text("logo_url").notNull(),
    category: text("category").notNull().default("PARTNER").$type<BplSponsorCategory>(),
    websiteUrl: text("website_url"),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_bpl_edition_sponsors_edition_id").on(t.editionId),
    index("ix_bpl_edition_sponsors_order").on(t.editionId, t.displayOrder),
  ],
);

export const insertBplEditionSponsorSchema = createInsertSchema(bplEditionSponsorsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BplEditionSponsor = typeof bplEditionSponsorsTable.$inferSelect;
export type InsertBplEditionSponsor = z.infer<typeof insertBplEditionSponsorSchema>;
