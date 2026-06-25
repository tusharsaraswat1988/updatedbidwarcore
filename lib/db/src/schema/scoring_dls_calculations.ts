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

/** DLS revision audit trail per match (rain interruptions). */
export const scoringDlsCalculationsTable = pgTable(
  "scoring_dls_calculations",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    revision: integer("revision").notNull().default(1),
    inputsJson: jsonb("inputs_json").$type<Record<string, unknown>>().notNull(),
    outputsJson: jsonb("outputs_json").$type<Record<string, unknown>>().notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    reason: text("reason"),
  },
  (t) => [
    index("ix_scoring_dls_match_id").on(t.matchId),
    index("ix_scoring_dls_tournament_id").on(t.tournamentId),
  ],
);

export const insertScoringDlsCalculationSchema = createInsertSchema(scoringDlsCalculationsTable).omit({
  id: true,
  appliedAt: true,
});

export type ScoringDlsCalculation = typeof scoringDlsCalculationsTable.$inferSelect;
export type InsertScoringDlsCalculation = z.infer<typeof insertScoringDlsCalculationSchema>;
