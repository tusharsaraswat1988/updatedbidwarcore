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
