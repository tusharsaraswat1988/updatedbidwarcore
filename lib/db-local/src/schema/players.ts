import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const playersTable = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  status: text("status").notNull().default("available"),
  jerseyNumber: text("jersey_number"),
  achievements: text("achievements"),
  mobileNumber: text("mobile_number"),
  cricheroUrl: text("crichero_url"),
  availabilityDates: text("availability_dates"),
  specialization: text("specialization"),
  cloudId: integer("cloud_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Player = typeof playersTable.$inferSelect;
