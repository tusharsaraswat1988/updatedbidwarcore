import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const showcaseEventsTable = pgTable("showcase_events", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  sportName: text("sport_name").notNull(),
  tournamentName: text("tournament_name").notNull(),
  description: text("description"),
  altText: text("alt_text"),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShowcaseEventSchema = createInsertSchema(showcaseEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShowcaseEvent = z.infer<typeof insertShowcaseEventSchema>;
export type ShowcaseEvent = typeof showcaseEventsTable.$inferSelect;
