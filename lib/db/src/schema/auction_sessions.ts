import { pgTable, serial, timestamp, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auctionSessionsTable = pgTable("auction_sessions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().unique(),
  status: text("status").notNull().default("idle"),
  currentPlayerId: integer("current_player_id"),
  currentBid: integer("current_bid"),
  currentBidTeamId: integer("current_bid_team_id"),
  timerSeconds: integer("timer_seconds"),
  timerEndsAt: text("timer_ends_at"),
  timerType: text("timer_type"),
  lastAction: text("last_action"),
  isBreak: boolean("is_break").notNull().default(false),
  breakEndsAt: text("break_ends_at"),
  fortuneWheelActive: boolean("fortune_wheel_active").notNull().default(false),
  teamPurseViewActive: boolean("team_purse_view_active").notNull().default(false),
  wheelItemsJson: text("wheel_items_json"),
  wheelWinner: text("wheel_winner"),
  activeCategoryIds: text("active_category_ids"),
  pausedTimeRemaining: integer("paused_time_remaining"),
  soldPlayersCount: integer("sold_players_count").notNull().default(0),
  unsoldPlayersCount: integer("unsold_players_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAuctionSessionSchema = createInsertSchema(auctionSessionsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertAuctionSession = z.infer<typeof insertAuctionSessionSchema>;
export type AuctionSession = typeof auctionSessionsTable.$inferSelect;
