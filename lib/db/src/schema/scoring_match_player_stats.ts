import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type BattingStatsJson = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  notOut: boolean;
  dismissalType: string | null;
};

export type BowlingStatsJson = {
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  economy: number;
};

export type FieldingStatsJson = {
  catches: number;
  runOuts: number;
  stumpings: number;
};

/** Per-match player stats — projected from ball events on match complete. */
export const scoringMatchPlayerStatsTable = pgTable(
  "scoring_match_player_stats",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull(),
    innings: integer("innings").notNull(),
    battingJson: jsonb("batting_json").$type<BattingStatsJson | null>(),
    bowlingJson: jsonb("bowling_json").$type<BowlingStatsJson | null>(),
    fieldingJson: jsonb("fielding_json").$type<FieldingStatsJson>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_scoring_mps_match_player_innings").on(
      t.matchId,
      t.playerId,
      t.innings,
    ),
    index("ix_scoring_mps_tournament_id").on(t.tournamentId),
    index("ix_scoring_mps_match_id").on(t.matchId),
    index("ix_scoring_mps_player_id").on(t.playerId),
  ],
);

export const insertScoringMatchPlayerStatsSchema = createInsertSchema(
  scoringMatchPlayerStatsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringMatchPlayerStats = typeof scoringMatchPlayerStatsTable.$inferSelect;
export type InsertScoringMatchPlayerStats = z.infer<typeof insertScoringMatchPlayerStatsSchema>;
