import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Auction Intelligence Event Log
 *
 * Three append-only tables that capture the full behavioral history of every
 * auction. Data is never overwritten — rows are only ever INSERTed.
 * These tables are the foundation for future AI recommendations, bidding heat
 * analysis, player valuation scoring, and team strategy profiling.
 *
 * Engineering contract:
 * - ALL writes are fire-and-forget (never awaited in the hot bid path)
 * - Logging failures are silently swallowed — auction flow takes priority
 * - Rows accumulate indefinitely; no TTL or pruning unless explicitly requested
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. BID EVENTS — every live bid placed during an auction
// ─────────────────────────────────────────────────────────────────────────────
export const auctionBidEventsTable = pgTable("auction_bid_events", {
  id: serial("id").primaryKey(),

  // Context
  tournamentId: integer("tournament_id").notNull(),
  playerId: integer("player_id").notNull(),
  globalPlayerId: text("global_player_id"),   // nullable — filled when player is linked
  teamId: integer("team_id").notNull(),
  sport: text("sport").notNull().default("cricket"),

  // Bid amounts
  bidAmount: integer("bid_amount").notNull(),
  previousBidAmount: integer("previous_bid_amount"),
  bidIncrement: integer("bid_increment").notNull(),

  // Sequence & timing
  bidSequenceNumber: integer("bid_sequence_number").notNull(),   // 1-based counter within this player's auction
  millisecondsSinceLastBid: integer("milliseconds_since_last_bid"),   // null for first bid
  timerRemainingSeconds: integer("timer_remaining_seconds"),   // seconds left on clock when bid was placed

  // Bid characteristics
  isManualBid: boolean("is_manual_bid").notNull().default(false),   // true = operator manual-sell, false = live bid
  becameLeader: boolean("became_leader").notNull().default(true),   // always true for accepted live bids

  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PLAYER AUCTION EVENTS — one row per player-auction lifecycle event
//    Two rows per completed auction: 'in_progress' when put on block, then
//    'sold'/'unsold'/'deferred' when concluded. Fully append-only.
// ─────────────────────────────────────────────────────────────────────────────
export const auctionPlayerEventsTable = pgTable("auction_player_events", {
  id: serial("id").primaryKey(),

  // Context
  tournamentId: integer("tournament_id").notNull(),
  playerId: integer("player_id").notNull(),
  globalPlayerId: text("global_player_id"),
  categoryId: integer("category_id"),
  sport: text("sport").notNull().default("cricket"),

  // Player snapshot at time of auction (denormalised for historical fidelity)
  playerName: text("player_name").notNull(),
  playerRole: text("player_role"),
  playerAge: integer("player_age"),
  playerCity: text("player_city"),
  playerSnapshotJson: text("player_snapshot_json"),   // full JSON of player row

  // Base price
  basePrice: integer("base_price"),

  // Lifecycle
  outcome: text("outcome").notNull(),   // 'in_progress' | 'sold' | 'unsold' | 'deferred'
  auctionStartedAt: timestamp("auction_started_at", { withTimezone: true }).notNull().defaultNow(),
  auctionEndedAt: timestamp("auction_ended_at", { withTimezone: true }),

  // Results (populated on conclusion)
  finalAmount: integer("final_amount"),
  soldToTeamId: integer("sold_to_team_id"),
  soldToTeamName: text("sold_to_team_name"),

  // Aggregate stats (populated on conclusion)
  totalBidsReceived: integer("total_bids_received"),
  interestedTeamsCount: integer("interested_teams_count"),   // distinct teams that bid
  auctionDurationSeconds: integer("auction_duration_seconds"),
  averageSecsBetweenBids: integer("average_secs_between_bids"),

  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TIMER EVENTS — every timer interaction (start / stop / extend / expired)
// ─────────────────────────────────────────────────────────────────────────────
export const auctionTimerEventsTable = pgTable("auction_timer_events", {
  id: serial("id").primaryKey(),

  // Context
  tournamentId: integer("tournament_id").notNull(),
  playerId: integer("player_id"),   // which player was on the block (null if no player)

  // Event details
  action: text("action").notNull(),       // 'start' | 'stop' | 'extend' | 'expired'
  timerType: text("timer_type"),          // 'start' | 'bid' (matches session.timerType)
  timerSeconds: integer("timer_seconds"), // seconds configured / set
  triggeredBy: text("triggered_by").notNull().default("operator"),  // 'operator' | 'system'

  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type AuctionBidEvent = typeof auctionBidEventsTable.$inferSelect;
export type AuctionPlayerEvent = typeof auctionPlayerEventsTable.$inferSelect;
export type AuctionTimerEvent = typeof auctionTimerEventsTable.$inferSelect;
