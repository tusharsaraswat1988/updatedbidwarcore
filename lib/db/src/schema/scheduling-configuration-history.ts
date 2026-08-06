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
 * Append-only locked Scheduling Configuration history (EPIC-07).
 * Working Configuration lives on badminton_draws / scoring_draws via bridges.
 * Freeze writes Version N here — configuration + locked slot + assignment structure only.
 * Never stores runtime matches, results, or actual start/end times.
 * No Scheduling table — keyed by product scheduling_key (= Fixture Identity).
 */
export const schedulingConfigurationHistoryTable = pgTable(
  "scheduling_configuration_history",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    /** Product Scheduling Plan id (= Fixture Identity): bd-{id} | sd-{id}. */
    schedulingKey: text("scheduling_key").notNull(),
    source: text("source").notNull(),
    sourceId: integer("source_id").notNull(),
    version: integer("version").notNull().default(1),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    checksum: text("checksum"),
    frozenBy: text("frozen_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_scheduling_configuration_history_key_version").on(
      t.schedulingKey,
      t.version,
    ),
  ],
);

export type SchedulingConfigurationHistory =
  typeof schedulingConfigurationHistoryTable.$inferSelect;
