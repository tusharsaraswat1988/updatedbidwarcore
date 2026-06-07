import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Live scoreboard projection for a match (mirrors auction_sessions pattern).
 * state_json is derived from scoring_events — never the source of truth.
 */
export const scoringSessionsTable = pgTable(
  "scoring_sessions",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    status: text("status").notNull().default("idle"),
    stateJson: jsonb("state_json").$type<Record<string, unknown>>(),
    displayOverlay: text("display_overlay"),
    displayOverlayJson: jsonb("display_overlay_json").$type<Record<string, unknown>>(),
    lastEventSeq: bigint("last_event_seq", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("uq_scoring_sessions_match_id").on(t.matchId)],
);

export const insertScoringSessionSchema = createInsertSchema(scoringSessionsTable).omit({
  id: true,
  updatedAt: true,
});

export type ScoringSession = typeof scoringSessionsTable.$inferSelect;
export type InsertScoringSession = z.infer<typeof insertScoringSessionSchema>;
