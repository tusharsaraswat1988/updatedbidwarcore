import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  name: text("name").notNull(),
  shortCode: text("short_code").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerMobile: text("owner_mobile"),
  color: text("color").default("#3B82F6"),
  logoUrl: text("logo_url"),
  purse: integer("purse").notNull().default(10000000),
  purseUsed: integer("purse_used").notNull().default(0),
  isBiddingEnabled: boolean("is_bidding_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
