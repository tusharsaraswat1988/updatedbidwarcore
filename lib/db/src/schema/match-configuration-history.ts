import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Append-only locked Match Configuration history (EPIC-05).
 * Working Configuration lives on scoring_matches; freeze writes Version N here.
 * Never stores score, events, officials history, or roster history.
 */
export const matchConfigurationHistoryTable = pgTable(
  "match_configuration_history",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    matchId: integer("match_id").notNull(),
    version: integer("version").notNull().default(1),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    checksum: text("checksum"),
    frozenBy: text("frozen_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_match_configuration_history_match_version").on(t.matchId, t.version),
  ],
);

export type MatchConfigurationHistory =
  typeof matchConfigurationHistoryTable.$inferSelect;
