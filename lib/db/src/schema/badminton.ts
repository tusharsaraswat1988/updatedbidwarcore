/**
 * Badminton Tournament Management System — Database Schema
 *
 * Tables:
 * - badminton_players        Extended player profiles
 * - badminton_courts         Physical courts in a tournament
 * - badminton_categories     Tournament draw categories (Men's Singles, etc.)
 * - badminton_registrations  Player entry to a category draw
 * - badminton_draws          Draw brackets / groups per category
 * - badminton_fixtures       Individual matches within a draw
 * - badminton_match_details  Extended match info beyond scoring_matches
 */

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  smallint,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Badminton Players ───────────────────────────────────────────────────────

export const badmintonPlayersTable = pgTable(
  "badminton_players",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    /** External global player reference (if linked). */
    globalPlayerId: integer("global_player_id"),
    /** BWF player code (e.g. "INPV01234"). */
    bwfCode: text("bwf_code"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** Display name (may include team name for club events). */
    displayName: text("display_name"),
    /** Short identifier (used on scoreboard). */
    shortName: text("short_name"),
    /** National federation code (ISO 3166-1 alpha-3). */
    countryCode: text("country_code"),
    countryName: text("country_name"),
    /** State / regional federation. */
    stateName: text("state_name"),
    /** Academy / club name. */
    academyName: text("academy_name"),
    /** Date of birth. */
    dateOfBirth: text("date_of_birth"),
    /** Age group at time of tournament. */
    ageGroup: text("age_group"),
    /** M | F | Mixed. */
    gender: text("gender"),
    /** R (right) | L (left). */
    handedness: text("handedness"),
    /** Contact mobile. */
    mobile: text("mobile"),
    /** Contact email. */
    email: text("email"),
    /** Photo URL (Cloudinary). */
    photoUrl: text("photo_url"),
    /** National flag or team logo URL. */
    flagUrl: text("flag_url"),
    /** National / team color (hex). */
    teamColor: text("team_color"),
    /** BWF world ranking. */
    worldRanking: integer("world_ranking"),
    /** National ranking. */
    nationalRanking: integer("national_ranking"),
    /** Player status in this tournament. */
    status: text("status").notNull().default("active"),
    /** JSON for arbitrary extra info. */
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_bp_tournament_id").on(t.tournamentId),
    index("ix_bp_bwf_code").on(t.bwfCode),
  ],
);

export const insertBadmintonPlayerSchema = createInsertSchema(badmintonPlayersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BadmintonPlayer = typeof badmintonPlayersTable.$inferSelect;
export type InsertBadmintonPlayer = z.infer<typeof insertBadmintonPlayerSchema>;

// ─── Badminton Courts ────────────────────────────────────────────────────────

export const badmintonCourtsTable = pgTable(
  "badminton_courts",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    /** Court name / number (e.g. "Court 1", "Main Court"). */
    name: text("name").notNull(),
    /** Short label for scoreboard (e.g. "C1"). */
    shortName: text("short_name"),
    /** Physical location / hall. */
    location: text("location"),
    /** Current operational status. */
    status: text("status").notNull().default("available"),
    /** Display order. */
    sortOrder: smallint("sort_order").notNull().default(0),
    /** Optional streaming URL (OBS source). */
    streamUrl: text("stream_url"),
    /** Court has display screen connected. */
    hasDisplay: boolean("has_display").notNull().default(false),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ix_bc_tournament_id").on(t.tournamentId)],
);

export const insertBadmintonCourtSchema = createInsertSchema(badmintonCourtsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BadmintonCourt = typeof badmintonCourtsTable.$inferSelect;
export type InsertBadmintonCourt = z.infer<typeof insertBadmintonCourtSchema>;

// ─── Badminton Draw Categories ────────────────────────────────────────────────

export const badmintonCategoriesTable = pgTable(
  "badminton_categories",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    /** e.g. "Men's Singles Under-19" */
    name: text("name").notNull(),
    /** Short code (e.g. "MS-U19"). */
    code: text("code"),
    /** singles | doubles | mixed_doubles */
    matchType: text("match_type").notNull().default("singles"),
    /** Age group (e.g. "U15", "U19", "Senior"). */
    ageGroup: text("age_group"),
    /** Gender restriction (M | F | Mixed). */
    gender: text("gender"),
    /** Match format JSON (BWF standard if null). */
    matchFormatJson: jsonb("match_format_json").$type<{
      totalGames: number;
      pointsPerGame: number;
      deuceAt: number;
      maxPoints: number;
      midGameSideChange: boolean;
    }>(),
    /** Draw type: knockout | round_robin | group_knockout */
    drawType: text("draw_type").notNull().default("knockout"),
    /** Number of seeds. */
    numSeeds: smallint("num_seeds").notNull().default(0),
    /** Phase: setup | draw_generated | live | completed */
    phase: text("phase").notNull().default("setup"),
    /** Max players allowed. */
    maxPlayers: integer("max_players"),
    /** Registration fee (paise or cents). */
    entryFee: integer("entry_fee"),
    /** Prize money (paise or cents). */
    prizeMoney: integer("prize_money"),
    /** Display order in tournament. */
    sortOrder: smallint("sort_order").notNull().default(0),
    /** Color code for UI. */
    colorCode: text("color_code"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ix_bcat_tournament_id").on(t.tournamentId)],
);

export const insertBadmintonCategorySchema = createInsertSchema(badmintonCategoriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BadmintonCategory = typeof badmintonCategoriesTable.$inferSelect;
export type InsertBadmintonCategory = z.infer<typeof insertBadmintonCategorySchema>;

// ─── Registrations ──────────────────────────────────────────────────────────

export const badmintonRegistrationsTable = pgTable(
  "badminton_registrations",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    categoryId: integer("category_id").notNull(),
    /** For singles: player1Id only. For doubles: both IDs. */
    player1Id: integer("player1_id").notNull(),
    player2Id: integer("player2_id"),
    /** Seed number (null = unseeded). */
    seedNumber: smallint("seed_number"),
    /** Entry status: pending | accepted | withdrawn | disqualified */
    status: text("status").notNull().default("accepted"),
    /** Registration timestamp. */
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    /** Payment reference. */
    paymentRef: text("payment_ref"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_breg_tournament_id").on(t.tournamentId),
    index("ix_breg_category_id").on(t.categoryId),
    index("ix_breg_player1_id").on(t.player1Id),
  ],
);

export const insertBadmintonRegistrationSchema = createInsertSchema(
  badmintonRegistrationsTable,
).omit({ id: true, createdAt: true, updatedAt: true, registeredAt: true });
export type BadmintonRegistration = typeof badmintonRegistrationsTable.$inferSelect;
export type InsertBadmintonRegistration = z.infer<typeof insertBadmintonRegistrationSchema>;

// ─── Draw Brackets ──────────────────────────────────────────────────────────

export const badmintonDrawsTable = pgTable(
  "badminton_draws",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    categoryId: integer("category_id").notNull(),
    /** Round name (e.g. "Round of 16", "Quarterfinal", "Group A"). */
    roundName: text("round_name").notNull(),
    /** Round number (1 = first round). */
    roundNumber: smallint("round_number").notNull().default(1),
    /** Total rounds in this draw. */
    totalRounds: smallint("total_rounds"),
    /** knockout_round | group | playoff */
    drawKind: text("draw_kind").notNull().default("knockout_round"),
    /** Group identifier (for round-robin groups). */
    groupId: text("group_id"),
    /** Draw status: pending | active | completed */
    status: text("status").notNull().default("pending"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_bd_tournament_id").on(t.tournamentId),
    index("ix_bd_category_id").on(t.categoryId),
  ],
);

export const insertBadmintonDrawSchema = createInsertSchema(badmintonDrawsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BadmintonDraw = typeof badmintonDrawsTable.$inferSelect;
export type InsertBadmintonDraw = z.infer<typeof insertBadmintonDrawSchema>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const badmintonFixturesTable = pgTable(
  "badminton_fixtures",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    categoryId: integer("category_id").notNull(),
    drawId: integer("draw_id").notNull(),
    /** Position in the draw (e.g. slot 1 of QF). */
    slotNumber: smallint("slot_number"),
    /** Registration ID for side A (null = TBD). */
    registrationAId: integer("registration_a_id"),
    /** Registration ID for side B (null = TBD). */
    registrationBId: integer("registration_b_id"),
    /** Where winner advances to (fixture_id). */
    winnerAdvancesTo: integer("winner_advances_to"),
    /** Loser goes to consolation fixture (fixture_id). */
    loserAdvancesTo: integer("loser_advances_to"),
    /** Linked scoring match (when created). */
    scoringMatchId: integer("scoring_match_id"),
    /** Assigned court. */
    courtId: integer("court_id"),
    /** Scheduled time slot. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** Actual start. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    /** Actual end. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Fixture status: scheduled | live | completed | cancelled | walkover */
    status: text("status").notNull().default("scheduled"),
    /** Winner registration ID. */
    winnerRegistrationId: integer("winner_registration_id"),
    /** Result summary string. */
    resultSummary: text("result_summary"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_bfix_tournament_id").on(t.tournamentId),
    index("ix_bfix_category_id").on(t.categoryId),
    index("ix_bfix_draw_id").on(t.drawId),
    index("ix_bfix_court_id").on(t.courtId),
    index("ix_bfix_status").on(t.status),
  ],
);

export const insertBadmintonFixtureSchema = createInsertSchema(badmintonFixturesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BadmintonFixture = typeof badmintonFixturesTable.$inferSelect;
export type InsertBadmintonFixture = z.infer<typeof insertBadmintonFixtureSchema>;

// ─── Extended Match Details ──────────────────────────────────────────────────

export const badmintonMatchDetailsTable = pgTable(
  "badminton_match_details",
  {
    id: serial("id").primaryKey(),
    /** FK to scoring_matches.id */
    scoringMatchId: integer("scoring_match_id").notNull().unique(),
    tournamentId: integer("tournament_id").notNull(),
    categoryId: integer("category_id"),
    fixtureId: integer("fixture_id"),
    courtId: integer("court_id"),
    courtNumber: text("court_number"),
    matchNumber: text("match_number"),
    matchLabel: text("match_label"),
    roundName: text("round_name"),
    /** singles | doubles | mixed_doubles */
    matchType: text("match_type").notNull().default("singles"),
    /** BWF match format JSON. */
    matchFormatJson: jsonb("match_format_json").$type<Record<string, unknown>>(),
    /** Left side player/pair display info (cached for scoreboard). */
    leftSideJson: jsonb("left_side_json").$type<Record<string, unknown>>(),
    /** Right side player/pair display info (cached for scoreboard). */
    rightSideJson: jsonb("right_side_json").$type<Record<string, unknown>>(),
    /** Scorer's PIN (if using per-match PIN). */
    scorerPin: text("scorer_pin"),
    /** Assigned scorer name. */
    scorerName: text("scorer_name"),
    /** Referee name. */
    refereeName: text("referee_name"),
    /** Umpire name. */
    umpireName: text("umpire_name"),
    /** Service judge. */
    serviceJudgeName: text("service_judge_name"),
    /** Replay of current match state (computed after each event). */
    stateSnapshotJson: jsonb("state_snapshot_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_bmd_tournament_id").on(t.tournamentId),
    index("ix_bmd_court_id").on(t.courtId),
    index("ix_bmd_scoring_match_id").on(t.scoringMatchId),
  ],
);

export const insertBadmintonMatchDetailSchema = createInsertSchema(
  badmintonMatchDetailsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type BadmintonMatchDetail = typeof badmintonMatchDetailsTable.$inferSelect;
export type InsertBadmintonMatchDetail = z.infer<typeof insertBadmintonMatchDetailSchema>;

// ─── Tournament Analytics Snapshots ─────────────────────────────────────────

export const badmintonAnalyticsTable = pgTable(
  "badminton_analytics",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().unique(),
    /** Longest rally (number of strokes). */
    longestRally: integer("longest_rally"),
    /** Match ID of the longest rally. */
    longestRallyMatchId: integer("longest_rally_match_id"),
    /** Most consecutive points. */
    maxConsecutivePoints: integer("max_consecutive_points"),
    /** Fastest match in minutes. */
    fastestMatchMinutes: real("fastest_match_minutes"),
    /** Total rallies across all matches. */
    totalRallies: integer("total_rallies"),
    /** Average rally duration in seconds. */
    avgRallyDurationSecs: real("avg_rally_duration_secs"),
    /** Total matches played. */
    matchesPlayed: integer("matches_played"),
    /** Total matches completed. */
    matchesCompleted: integer("matches_completed"),
    /** Player with most wins. */
    topPlayerPlayerId: integer("top_player_player_id"),
    /** Full analytics JSON. */
    analyticsJson: jsonb("analytics_json").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_banalytics_tournament_id").on(t.tournamentId)],
);

export type BadmintonAnalytics = typeof badmintonAnalyticsTable.$inferSelect;
