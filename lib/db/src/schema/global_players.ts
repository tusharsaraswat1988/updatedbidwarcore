import { pgTable, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Global player identity — one row per physical person, across all tournaments.
 *
 * Players in individual tournaments reference this table via
 * playersTable.globalPlayerId (nullable text).
 *
 * mobileNumber is the primary deduplication key — if two tournament-level
 * player records share the same mobile, they are the same person.
 *
 * This table is the future anchor for:
 * - cross-tournament performance tracking
 * - AI-based player valuation
 * - historical auction analytics
 * - multi-sport support
 * - franchise history and verification
 */
export const globalPlayersTable = pgTable(
  "global_players",
  {
    id: text("id").primaryKey(), // gp_XXXXXX format
    canonicalName: text("canonical_name").notNull(),
    mobileNumber: text("mobile_number"), // unique dedup key
    sport: text("sport").notNull().default("cricket"),
    defaultRole: text("default_role"),
    city: text("city"),
    age: integer("age"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("ix_gp_mobile").on(t.mobileNumber),
    index("ix_gp_canonical_name").on(t.canonicalName),
  ],
);

export const insertGlobalPlayerSchema = createInsertSchema(globalPlayersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGlobalPlayer = z.infer<typeof insertGlobalPlayerSchema>;
export type GlobalPlayer = typeof globalPlayersTable.$inferSelect;
