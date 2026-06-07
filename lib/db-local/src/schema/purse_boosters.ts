import { sqliteTable, integer, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const purseBoostersTable = sqliteTable(
  "purse_boosters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    localUuid: text("local_uuid").notNull(),
    cloudId: integer("cloud_id"),
    tournamentId: integer("tournament_id").notNull(),
    teamId: integer("team_id").notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("active"),
    createdByType: text("created_by_type").notNull(),
    createdById: text("created_by_id"),
    createdByLabel: text("created_by_label"),
    createdAt: text("created_at").notNull(),
    cancelledByType: text("cancelled_by_type"),
    cancelledById: text("cancelled_by_id"),
    cancelledByLabel: text("cancelled_by_label"),
    cancelledAt: text("cancelled_at"),
    cancelReason: text("cancel_reason"),
    previousCapacity: integer("previous_capacity").notNull(),
    newCapacity: integer("new_capacity").notNull(),
    origin: text("origin").notNull().default("local"),
    syncState: text("sync_state").notNull().default("pending"),
  },
  (t) => [
    uniqueIndex("ux_purse_boosters_local_uuid").on(t.localUuid),
    index("ix_purse_boosters_tournament_team_status").on(
      t.tournamentId,
      t.teamId,
      t.status,
    ),
  ],
);

export type PurseBooster = typeof purseBoostersTable.$inferSelect;
export type InsertPurseBooster = typeof purseBoostersTable.$inferInsert;
