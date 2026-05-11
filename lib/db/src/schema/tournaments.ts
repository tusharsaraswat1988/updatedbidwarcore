import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("cricket"),
  venue: text("venue"),
  auctionDate: text("auction_date"),
  organizerName: text("organizer_name"),
  basePurse: integer("base_purse").notNull().default(10000000),
  minBid: integer("min_bid").notNull().default(100000),
  bidIncrement: integer("bid_increment").notNull().default(100000),
  timerSeconds: integer("timer_seconds").notNull().default(30),
  status: text("status").notNull().default("setup"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
