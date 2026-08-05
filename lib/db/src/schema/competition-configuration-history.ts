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
 * Append-only locked Competition Plan history (EPIC-03).
 * Working Configuration lives on tournaments; freeze writes Version N here.
 */
export const competitionConfigurationHistoryTable = pgTable(
  "competition_configuration_history",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    version: integer("version").notNull().default(1),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    checksum: text("checksum"),
    frozenBy: text("frozen_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_competition_configuration_history_tournament_version").on(
      t.tournamentId,
      t.version,
    ),
  ],
);

export type CompetitionConfigurationHistory =
  typeof competitionConfigurationHistoryTable.$inferSelect;
