import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Append-only purse capacity adjustments — never modifies teams.purse. */
export const purseBoostersTable = pgTable(
  "purse_boosters",
  {
    id: serial("id").primaryKey(),
    localUuid: text("local_uuid").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    teamId: integer("team_id").notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("active"),
    createdByType: text("created_by_type").notNull(),
    createdById: text("created_by_id"),
    createdByLabel: text("created_by_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledByType: text("cancelled_by_type"),
    cancelledById: text("cancelled_by_id"),
    cancelledByLabel: text("cancelled_by_label"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    previousCapacity: integer("previous_capacity").notNull(),
    newCapacity: integer("new_capacity").notNull(),
    origin: text("origin").notNull().default("cloud"),
    syncState: text("sync_state").notNull().default("synced"),
  },
  (t) => [
    uniqueIndex("ux_purse_boosters_local_uuid").on(t.localUuid),
    index("ix_purse_boosters_tournament_team_status").on(t.tournamentId, t.teamId, t.status),
    index("ix_purse_boosters_sync_pending").on(t.syncState),
  ],
);

export type PurseBooster = typeof purseBoostersTable.$inferSelect;
export type InsertPurseBooster = typeof purseBoostersTable.$inferInsert;
