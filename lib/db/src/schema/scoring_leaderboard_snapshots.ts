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

export type LeaderboardRowJson = {
  playerId: number;
  teamId: number;
  value: number;
  rank: number;
};

/** Precomputed tournament leaderboards — refreshed on match complete. */
export const scoringLeaderboardSnapshotsTable = pgTable(
  "scoring_leaderboard_snapshots",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    category: text("category").notNull(),
    rowsJson: jsonb("rows_json").$type<LeaderboardRowJson[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_scoring_lb_tournament_category").on(t.tournamentId, t.category),
    index("ix_scoring_lb_tournament_id").on(t.tournamentId),
  ],
);

export const insertScoringLeaderboardSnapshotSchema = createInsertSchema(
  scoringLeaderboardSnapshotsTable,
).omit({
  id: true,
  updatedAt: true,
});

export type ScoringLeaderboardSnapshot = typeof scoringLeaderboardSnapshotsTable.$inferSelect;
export type InsertScoringLeaderboardSnapshot = z.infer<
  typeof insertScoringLeaderboardSnapshotSchema
>;
