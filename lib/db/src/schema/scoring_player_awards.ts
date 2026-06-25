import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Post-match awards projected on match complete (MoM, etc.). */
export const scoringPlayerAwardsTable = pgTable(
  "scoring_player_awards",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull(),
    awardType: text("award_type").notNull().default("man_of_the_match"),
    selectionMethod: text("selection_method").notNull().default("auto"),
    score: integer("score"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_scoring_awards_match_type").on(t.matchId, t.awardType),
    index("ix_scoring_awards_tournament_id").on(t.tournamentId),
    index("ix_scoring_awards_player_id").on(t.playerId),
  ],
);

export const insertScoringPlayerAwardSchema = createInsertSchema(scoringPlayerAwardsTable).omit({
  id: true,
  createdAt: true,
});

export type ScoringPlayerAward = typeof scoringPlayerAwardsTable.$inferSelect;
export type InsertScoringPlayerAward = z.infer<typeof insertScoringPlayerAwardSchema>;
