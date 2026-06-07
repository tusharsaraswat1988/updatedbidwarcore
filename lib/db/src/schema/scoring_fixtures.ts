import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Optional scheduling container for one or more scoring matches.
 * Flow A: matches with fixture_id = null (direct create).
 * Flow B: fixture groups matches for leagues, knockouts, etc.
 */
export const scoringFixturesTable = pgTable(
  "scoring_fixtures",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    sportSlug: text("sport_slug").notNull().default("cricket"),
    fixtureNumber: integer("fixture_number"),
    roundName: text("round_name"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    venue: text("venue"),
    status: text("status").notNull().default("scheduled"),
    formatJson: jsonb("format_json").$type<Record<string, unknown>>(),
    homeTeamId: integer("home_team_id").notNull(),
    awayTeamId: integer("away_team_id").notNull(),
    winnerTeamId: integer("winner_team_id"),
    resultSummary: text("result_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_scoring_fixtures_tournament_id").on(t.tournamentId),
    index("ix_scoring_fixtures_tournament_status").on(t.tournamentId, t.status),
  ],
);

export const insertScoringFixtureSchema = createInsertSchema(scoringFixturesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringFixture = typeof scoringFixturesTable.$inferSelect;
export type InsertScoringFixture = z.infer<typeof insertScoringFixtureSchema>;
