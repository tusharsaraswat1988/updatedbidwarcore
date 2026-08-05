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
 * Append-only locked Fixture Configuration history (EPIC-06).
 * Working Configuration lives on badminton_draws / scoring_draws via bridges.
 * Freeze writes Version N here — configuration + locked node/blueprint structure only.
 * Never stores schedules, runtime matches, results, or standings.
 * No Fixture table — keyed by product fixture_key (bd-{id} | sd-{id}).
 */
export const fixtureConfigurationHistoryTable = pgTable(
  "fixture_configuration_history",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    /** Product Fixture Identity id: bd-{runtimeId} | sd-{runtimeId}. */
    fixtureKey: text("fixture_key").notNull(),
    source: text("source").notNull(),
    sourceId: integer("source_id").notNull(),
    version: integer("version").notNull().default(1),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    checksum: text("checksum"),
    frozenBy: text("frozen_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_fixture_configuration_history_key_version").on(
      t.fixtureKey,
      t.version,
    ),
  ],
);

export type FixtureConfigurationHistory =
  typeof fixtureConfigurationHistoryTable.$inferSelect;
