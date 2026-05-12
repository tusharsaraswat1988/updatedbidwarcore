import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const categoriesTable = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull(),
  name: text("name").notNull(),
  minBid: integer("min_bid").notNull().default(100000),
  bidIncrement: integer("bid_increment"),
  maxPlayers: integer("max_players"),
  colorCode: text("color_code").default("#F59E0B"),
  sortOrder: integer("sort_order").notNull().default(0),
  cloudId: integer("cloud_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Category = typeof categoriesTable.$inferSelect;
