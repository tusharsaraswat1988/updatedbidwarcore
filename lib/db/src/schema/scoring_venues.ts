import {
  pgTable,
  serial,
  text,
  integer,
  smallint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoringVenuesTable = pgTable(
  "scoring_venues",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    address: text("address"),
    surfaceType: text("surface_type"),
    status: text("status").notNull().default("active"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ix_scoring_venues_tournament_id").on(t.tournamentId)],
);

export const insertScoringVenueSchema = createInsertSchema(scoringVenuesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringVenue = typeof scoringVenuesTable.$inferSelect;
export type InsertScoringVenue = z.infer<typeof insertScoringVenueSchema>;
