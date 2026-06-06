import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const teamsTable = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull(),
  name: text("name").notNull(),
  shortCode: text("short_code").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerMobile: text("owner_mobile"),
  color: text("color").default("#3B82F6"),
  logoUrl: text("logo_url"),
  purse: integer("purse").notNull().default(10000000),
  purseUsed: integer("purse_used").notNull().default(0),
  isBiddingEnabled: integer("is_bidding_enabled", { mode: "boolean" }).notNull().default(true),
  accessCode: text("access_code"),
  cloudId: integer("cloud_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (t) => [
  uniqueIndex("uq_teams_tournament_owner_mobile").on(t.tournamentId, t.ownerMobile),
]);

export type Team = typeof teamsTable.$inferSelect;
