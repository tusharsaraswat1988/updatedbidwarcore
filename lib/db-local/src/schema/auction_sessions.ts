import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const auctionSessionsTable = sqliteTable("auction_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull().unique(),
  status: text("status").notNull().default("idle"),
  currentPlayerId: integer("current_player_id"),
  currentBid: integer("current_bid"),
  currentBidTeamId: integer("current_bid_team_id"),
  timerSeconds: integer("timer_seconds"),
  timerEndsAt: text("timer_ends_at"),
  lastAction: text("last_action"),
  isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
  breakEndsAt: text("break_ends_at"),
  fortuneWheelActive: integer("fortune_wheel_active", { mode: "boolean" }).notNull().default(false),
  teamPurseViewActive: integer("team_purse_view_active", { mode: "boolean" }).notNull().default(false),
  displayOverlay: text("display_overlay"),
  displayPlayerFilter: text("display_player_filter"),
  wheelItemsJson: text("wheel_items_json"),
  wheelWinner: text("wheel_winner"),
  activeCategoryIds: text("active_category_ids"),
  pausedTimeRemaining: integer("paused_time_remaining"),
  soldPlayersCount: integer("sold_players_count").notNull().default(0),
  unsoldPlayersCount: integer("unsold_players_count").notNull().default(0),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type AuctionSession = typeof auctionSessionsTable.$inferSelect;
