import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Intelligence archive — preserved when admin deletes a tournament.
 * Live auction tables are cleared; archived rows remain for training export.
 */

export const intelligenceArchivesTable = pgTable("intelligence_archives", {
  id: serial("id").primaryKey(),
  sourceTournamentId: integer("source_tournament_id").notNull(),
  tournamentName: text("tournament_name").notNull(),
  tournamentSport: text("tournament_sport").notNull().default("cricket"),
  organizerId: integer("organizer_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(),
  bidEventCount: integer("bid_event_count").notNull().default(0),
  playerEventCount: integer("player_event_count").notNull().default(0),
  timerEventCount: integer("timer_event_count").notNull().default(0),
  metadataJson: jsonb("metadata_json"),
});

export const intelligenceArchiveBidEventsTable = pgTable("intelligence_archive_bid_events", {
  id: serial("id").primaryKey(),
  archiveId: integer("archive_id").notNull(),
  sourceTournamentId: integer("source_tournament_id").notNull(),
  sourceEventId: integer("source_event_id"),
  tournamentName: text("tournament_name").notNull(),
  tournamentSport: text("tournament_sport").notNull(),
  playerId: integer("player_id").notNull(),
  globalPlayerId: text("global_player_id"),
  teamId: integer("team_id").notNull(),
  teamName: text("team_name"),
  teamShortCode: text("team_short_code"),
  sport: text("sport").notNull(),
  bidAmount: integer("bid_amount").notNull(),
  previousBidAmount: integer("previous_bid_amount"),
  bidIncrement: integer("bid_increment").notNull(),
  bidSequenceNumber: integer("bid_sequence_number").notNull(),
  millisecondsSinceLastBid: integer("milliseconds_since_last_bid"),
  timerRemainingSeconds: integer("timer_remaining_seconds"),
  isManualBid: boolean("is_manual_bid").notNull().default(false),
  becameLeader: boolean("became_leader").notNull().default(true),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const intelligenceArchivePlayerEventsTable = pgTable("intelligence_archive_player_events", {
  id: serial("id").primaryKey(),
  archiveId: integer("archive_id").notNull(),
  sourceTournamentId: integer("source_tournament_id").notNull(),
  sourceEventId: integer("source_event_id"),
  tournamentName: text("tournament_name").notNull(),
  tournamentSport: text("tournament_sport").notNull(),
  playerId: integer("player_id").notNull(),
  globalPlayerId: text("global_player_id"),
  categoryId: integer("category_id"),
  categoryName: text("category_name"),
  sport: text("sport").notNull(),
  playerName: text("player_name").notNull(),
  playerRole: text("player_role"),
  playerAge: integer("player_age"),
  playerCity: text("player_city"),
  playerSnapshotJson: text("player_snapshot_json"),
  basePrice: integer("base_price"),
  outcome: text("outcome").notNull(),
  auctionStartedAt: timestamp("auction_started_at", { withTimezone: true }),
  auctionEndedAt: timestamp("auction_ended_at", { withTimezone: true }),
  finalAmount: integer("final_amount"),
  soldToTeamId: integer("sold_to_team_id"),
  soldToTeamName: text("sold_to_team_name"),
  totalBidsReceived: integer("total_bids_received"),
  interestedTeamsCount: integer("interested_teams_count"),
  auctionDurationSeconds: integer("auction_duration_seconds"),
  averageSecsBetweenBids: integer("average_secs_between_bids"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const intelligenceArchiveTimerEventsTable = pgTable("intelligence_archive_timer_events", {
  id: serial("id").primaryKey(),
  archiveId: integer("archive_id").notNull(),
  sourceTournamentId: integer("source_tournament_id").notNull(),
  sourceEventId: integer("source_event_id"),
  tournamentName: text("tournament_name").notNull(),
  tournamentSport: text("tournament_sport").notNull(),
  playerId: integer("player_id"),
  action: text("action").notNull(),
  timerType: text("timer_type"),
  timerSeconds: integer("timer_seconds"),
  triggeredBy: text("triggered_by").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export type IntelligenceArchive = typeof intelligenceArchivesTable.$inferSelect;
