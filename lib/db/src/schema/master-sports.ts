/**
 * Master Sports Core — shared identity layer across Auction, Badminton, Cricket, etc.
 *
 * MasterPlayer reuses `global_players` (one physical person, cross-tournament).
 * MasterTeam / MasterSponsor are canonical entities; tournament-scoped auction
 * teams link via teams.master_team_id.
 */

import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { globalPlayersTable } from "./global_players";

/** Alias — MasterPlayer is stored in global_players. */
export const masterPlayersTable = globalPlayersTable;
export type MasterPlayer = typeof globalPlayersTable.$inferSelect;
export type InsertMasterPlayer = typeof globalPlayersTable.$inferInsert;

// ─── Master Sponsors ─────────────────────────────────────────────────────────

export const masterSponsorsTable = pgTable(
  "master_sponsors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    website: text("website"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ix_ms_name").on(t.name)],
);

export const insertMasterSponsorSchema = createInsertSchema(masterSponsorsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type MasterSponsor = typeof masterSponsorsTable.$inferSelect;
export type InsertMasterSponsor = z.infer<typeof insertMasterSponsorSchema>;

// ─── Master Teams ────────────────────────────────────────────────────────────

export const masterTeamsTable = pgTable(
  "master_teams",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    ownerName: text("owner_name"),
    sponsorId: text("sponsor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_mt_name").on(t.name),
    index("ix_mt_sponsor_id").on(t.sponsorId),
  ],
);

export const insertMasterTeamSchema = createInsertSchema(masterTeamsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type MasterTeam = typeof masterTeamsTable.$inferSelect;
export type InsertMasterTeam = z.infer<typeof insertMasterTeamSchema>;

// ─── Player ↔ Team assignments (auction sales, franchise roster) ─────────────

export const playerTeamAssignmentsTable = pgTable(
  "player_team_assignments",
  {
    id: serial("id").primaryKey(),
    playerId: text("player_id").notNull(),
    teamId: text("team_id").notNull(),
    tournamentId: integer("tournament_id"),
    seasonId: text("season_id"),
    sport: text("sport").notNull().default("cricket"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    auctionPlayerId: integer("auction_player_id"),
    auctionTeamId: integer("auction_team_id"),
  },
  (t) => [
    index("ix_pta_player_id").on(t.playerId),
    index("ix_pta_team_id").on(t.teamId),
    index("ix_pta_tournament_id").on(t.tournamentId),
    uniqueIndex("uq_pta_player_team_tournament").on(t.playerId, t.teamId, t.tournamentId),
  ],
);

export type PlayerTeamAssignment = typeof playerTeamAssignmentsTable.$inferSelect;
export type InsertPlayerTeamAssignment = typeof playerTeamAssignmentsTable.$inferInsert;

// ─── Per-sport player statistics (keyed by master player id) ─────────────────

export const playerStatisticsTable = pgTable(
  "player_statistics",
  {
    id: serial("id").primaryKey(),
    playerId: text("player_id").notNull(),
    sport: text("sport").notNull().default("badminton"),
    tournamentId: integer("tournament_id"),
    matchesPlayed: integer("matches_played").notNull().default(0),
    matchesWon: integer("matches_won").notNull().default(0),
    matchesLost: integer("matches_lost").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    gamesLost: integer("games_lost").notNull().default(0),
    pointsScored: integer("points_scored").notNull().default(0),
    pointsConceded: integer("points_conceded").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_ps_player_sport_tournament").on(t.playerId, t.sport, t.tournamentId),
    index("ix_ps_player_id").on(t.playerId),
  ],
);

export type PlayerStatistics = typeof playerStatisticsTable.$inferSelect;
export type InsertPlayerStatistics = typeof playerStatisticsTable.$inferInsert;

// ─── Legacy ID mappings (badminton_player_id → master_player_id) ─────────────

export const masterPlayerIdMappingsTable = pgTable(
  "master_player_id_mappings",
  {
    id: serial("id").primaryKey(),
    sourceModule: text("source_module").notNull(),
    sourcePlayerId: integer("source_player_id").notNull(),
    masterPlayerId: text("master_player_id").notNull(),
    tournamentId: integer("tournament_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_mpim_source").on(t.sourceModule, t.sourcePlayerId, t.tournamentId),
    index("ix_mpim_master_player_id").on(t.masterPlayerId),
  ],
);

export type MasterPlayerIdMapping = typeof masterPlayerIdMappingsTable.$inferSelect;

// ─── Sync audit log ──────────────────────────────────────────────────────────

export const masterSportsSyncLogTable = pgTable(
  "master_sports_sync_log",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    masterPlayerId: text("master_player_id"),
    masterTeamId: text("master_team_id"),
    detailsJson: text("details_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_mssl_created_at").on(t.createdAt)],
);
