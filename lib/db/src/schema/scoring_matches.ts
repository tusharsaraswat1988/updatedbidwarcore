import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Side descriptor for team and/or player references (future badminton). */
export type ScoringSideJson = {
  teamId: number;
  playerIds?: number[];
  displayName?: string;
};

export type ScoringMatchRulesJson = {
  overs?: number;
  maxWickets?: number;
};

export const scoringMatchesTable = pgTable(
  "scoring_matches",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    /** Null when created via Flow A (direct match). */
    fixtureId: integer("fixture_id"),
    sportSlug: text("sport_slug").notNull().default("cricket"),
    /** team_match | rubber | tie — V1 cricket uses team_match only. */
    matchKind: text("match_kind").notNull().default("team_match"),
    /** Future: groups rubbers under a tie. */
    parentMatchId: integer("parent_match_id"),
    sequenceInParent: integer("sequence_in_parent"),
    matchLabel: text("match_label"),
    roundName: text("round_name"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    venueId: integer("venue_id"),
    venue: text("venue"),
    officialsJson: jsonb("officials_json").$type<{
      umpires?: number[];
      scorers?: number[];
      matchReferee?: number | null;
    }>(),
    status: text("status").notNull().default("scheduled"),
    homeTeamId: integer("home_team_id").notNull(),
    awayTeamId: integer("away_team_id").notNull(),
    homeSideJson: jsonb("home_side_json").$type<ScoringSideJson>(),
    awaySideJson: jsonb("away_side_json").$type<ScoringSideJson>(),
    rulesJson: jsonb("rules_json").$type<ScoringMatchRulesJson>(),
    winnerTeamId: integer("winner_team_id"),
    resultSummary: text("result_summary"),
    /** Match Summary projection — derived from events (PR-5). */
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>(),
    currentProjectionVersion: bigint("current_projection_version", { mode: "number" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_scoring_matches_tournament_id").on(t.tournamentId),
    index("ix_scoring_matches_fixture_id").on(t.fixtureId),
    index("ix_scoring_matches_tournament_status").on(t.tournamentId, t.status),
  ],
);

export const insertScoringMatchSchema = createInsertSchema(scoringMatchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringMatch = typeof scoringMatchesTable.$inferSelect;
export type InsertScoringMatch = z.infer<typeof insertScoringMatchSchema>;
