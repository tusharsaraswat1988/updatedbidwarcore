import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Materialized points table — derived from completed match events. */
export const scoringStandingsTable = pgTable(
  "scoring_standings",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    teamId: integer("team_id").notNull(),
    played: integer("played").notNull().default(0),
    won: integer("won").notNull().default(0),
    lost: integer("lost").notNull().default(0),
    tied: integer("tied").notNull().default(0),
    noResult: integer("no_result").notNull().default(0),
    points: integer("points").notNull().default(0),
    netRunRate: numeric("net_run_rate"),
    extrasJson: jsonb("extras_json").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_scoring_standings_tournament_team").on(t.tournamentId, t.teamId),
    index("ix_scoring_standings_tournament_id").on(t.tournamentId),
  ],
);

export const insertScoringStandingSchema = createInsertSchema(scoringStandingsTable).omit({
  id: true,
  updatedAt: true,
});

export type ScoringStanding = typeof scoringStandingsTable.$inferSelect;
export type InsertScoringStanding = z.infer<typeof insertScoringStandingSchema>;
