import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  categoryId: integer("category_id"),
  teamId: integer("team_id"),
  name: text("name").notNull(),
  city: text("city"),
  role: text("role"),
  battingStyle: text("batting_style"),
  bowlingStyle: text("bowling_style"),
  age: integer("age"),
  photoUrl: text("photo_url"),
  basePrice: integer("base_price").notNull().default(100000),
  soldPrice: integer("sold_price"),
  retainedPrice: integer("retained_price"),
  status: text("status").notNull().default("available"), // available | sold | unsold | retained
  jerseyNumber: text("jersey_number"),
  achievements: text("achievements"),
  // New fields
  mobileNumber: text("mobile_number"),
  cricheroUrl: text("crichero_url"),
  availabilityDates: text("availability_dates"),
  specialization: text("specialization"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
