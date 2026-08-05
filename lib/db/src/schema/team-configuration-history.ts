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
 * Append-only locked Team Configuration history (EPIC-04).
 * Working Configuration lives on teams; freeze writes Version N here.
 * Never stores runtime roster history.
 */
export const teamConfigurationHistoryTable = pgTable(
  "team_configuration_history",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    teamId: integer("team_id").notNull(),
    version: integer("version").notNull().default(1),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    checksum: text("checksum"),
    frozenBy: text("frozen_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_team_configuration_history_team_version").on(t.teamId, t.version),
  ],
);

export type TeamConfigurationHistory =
  typeof teamConfigurationHistoryTable.$inferSelect;
