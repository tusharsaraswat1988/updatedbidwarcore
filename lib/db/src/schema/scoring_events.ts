import {
  pgTable,
  bigserial,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Append-only event store — source of truth for all scoring state.
 *
 * Engineering contract:
 * - INSERT only from application code (no UPDATE / DELETE)
 * - Corrections via compensating events (e.g. cricket.ball.undone)
 * - Per-match sequence is monotonic; UNIQUE (match_id, sequence)
 */
export const scoringEventsTable = pgTable(
  "scoring_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: integer("match_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    fixtureId: integer("fixture_id"),
    sportSlug: text("sport_slug").notNull().default("cricket"),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull().default(1),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    correlationId: uuid("correlation_id"),
    causationId: bigint("causation_id", { mode: "number" }),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  },
  (t) => [
    uniqueIndex("uq_scoring_events_match_sequence").on(t.matchId, t.sequence),
    index("ix_scoring_events_match_id").on(t.matchId),
    index("ix_scoring_events_tournament_id").on(t.tournamentId),
  ],
);

export const insertScoringEventSchema = createInsertSchema(scoringEventsTable).omit({
  id: true,
  recordedAt: true,
});

export type ScoringEvent = typeof scoringEventsTable.$inferSelect;
export type InsertScoringEvent = z.infer<typeof insertScoringEventSchema>;
