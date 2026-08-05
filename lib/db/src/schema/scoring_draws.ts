import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type ScoringDrawFormat =
  | "round_robin"
  | "league"
  | "knockout"
  | "league_knockout";

export type ScoringDrawConfigJson = {
  oversLimit?: number;
  teamIds?: number[];
  groups?: Array<{ name: string; teamIds: number[] }>;
  knockoutTeamsPerGroup?: number;
  doubleRoundRobin?: boolean;
};

export const scoringDrawsTable = pgTable(
  "scoring_draws",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    name: text("name").notNull(),
    format: text("format").notNull().$type<ScoringDrawFormat>(),
    configJson: jsonb("config_json").$type<ScoringDrawConfigJson>(),
    status: text("status").notNull().default("draft"),
    /** Platform Fixture Type catalog id (EPIC-06). */
    fixtureTypeId: text("fixture_type_id"),
    /** Platform Fixture lifecycle (EPIC-06) — separate from draw status. */
    lifecycleStatus: text("lifecycle_status").default("draft"),
    configurationLocked: boolean("configuration_locked").notNull().default(false),
    /** Platform Scheduling Strategy catalog id (EPIC-07). */
    schedulingStrategyId: text("scheduling_strategy_id"),
    /** Platform Scheduling lifecycle (EPIC-07) — separate from Fixture lifecycle. */
    schedulingLifecycleStatus: text("scheduling_lifecycle_status").default("draft"),
    schedulingConfigurationLocked: boolean("scheduling_configuration_locked")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ix_scoring_draws_tournament_id").on(t.tournamentId)],
);

export const insertScoringDrawSchema = createInsertSchema(scoringDrawsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringDraw = typeof scoringDrawsTable.$inferSelect;
export type InsertScoringDraw = z.infer<typeof insertScoringDrawSchema>;
