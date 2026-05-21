import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const displayAuctionsTable = pgTable("display_auctions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().default(""),
  sport: text("sport").notNull().default("cricket"),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  purse: integer("purse").notNull().default(1000000),
  playersPerTeam: integer("players_per_team").notNull().default(11),
  teamsCount: integer("teams_count").notNull().default(8),
  scheduledDate: text("scheduled_date").notNull().default(""),
  scheduledTime: text("scheduled_time").notNull().default("00:00"),
  primaryColor: text("primary_color").notNull().default("#1a3a6b"),
  accentColor: text("accent_color").notNull().default("#f5c842"),
  status: text("status").notNull().default("upcoming"),
  showOnLanding: boolean("show_on_landing").notNull().default(true),
  tournamentId: integer("tournament_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDisplayAuctionSchema = createInsertSchema(displayAuctionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDisplayAuction = z.infer<typeof insertDisplayAuctionSchema>;
export type DisplayAuction = typeof displayAuctionsTable.$inferSelect;
