import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Global player identity — one row per physical person, across all tournaments.
 *
 * Players in individual tournaments reference this table via
 * playersTable.globalPlayerId (nullable UUID stored as text).
 *
 * This table is the future anchor for:
 * - cross-tournament performance tracking
 * - AI-based player valuation
 * - historical auction analytics
 *
 * Population strategy:
 * - Initially all NULLs (no manual linking required to ship)
 * - Can be linked manually by organizers or auto-matched by a future ML pipeline
 */
export const globalPlayersTable = pgTable("global_players", {
  id: text("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  sport: text("sport").notNull().default("cricket"),
  defaultRole: text("default_role"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGlobalPlayerSchema = createInsertSchema(globalPlayersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGlobalPlayer = z.infer<typeof insertGlobalPlayerSchema>;
export type GlobalPlayer = typeof globalPlayersTable.$inferSelect;
