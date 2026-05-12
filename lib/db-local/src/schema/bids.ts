import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const bidsTable = sqliteTable("bids", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull(),
  playerId: integer("player_id").notNull(),
  teamId: integer("team_id").notNull(),
  amount: integer("amount").notNull(),
  timestamp: text("timestamp").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Bid = typeof bidsTable.$inferSelect;
