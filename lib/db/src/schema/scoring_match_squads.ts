import {
  pgTable,
  serial,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type MatchSquadJson = {
  playingXi: number[];
  bench: number[];
  battingOrder?: number[];
  captainId?: number | null;
  wicketKeeperId?: number | null;
};

export const scoringMatchSquadsTable = pgTable(
  "scoring_match_squads",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    teamId: integer("team_id").notNull(),
    squadJson: jsonb("squad_json").$type<MatchSquadJson>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_scoring_match_squads_match_team").on(t.matchId, t.teamId),
    index("ix_scoring_match_squads_match_id").on(t.matchId),
  ],
);

export const insertScoringMatchSquadSchema = createInsertSchema(scoringMatchSquadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScoringMatchSquad = typeof scoringMatchSquadsTable.$inferSelect;
export type InsertScoringMatchSquad = z.infer<typeof insertScoringMatchSquadSchema>;
