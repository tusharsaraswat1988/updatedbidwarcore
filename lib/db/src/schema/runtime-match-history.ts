import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Append-only Runtime Match history (EPIC-08).
 * Keyed by Match Identity (scoring_matches.id) — not a Runtime Match identity table.
 * Stores snapshot freezes, phase transitions, preparation / operator audit, validation.
 * Never stores scores, scoring events, statistics, or broadcast state.
 */
export const runtimeMatchHistoryTable = pgTable(
  "runtime_match_history",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    matchId: integer("match_id").notNull(),
    operation: text("operation").notNull(),
    snapshotVersion: integer("snapshot_version"),
    executionPhase: text("execution_phase"),
    actor: text("actor"),
    reason: text("reason"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_runtime_match_history_match_id").on(t.matchId),
    index("ix_runtime_match_history_match_created").on(t.matchId, t.createdAt),
  ],
);

export type RuntimeMatchHistory = typeof runtimeMatchHistoryTable.$inferSelect;
