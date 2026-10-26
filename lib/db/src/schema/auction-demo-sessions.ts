import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One loaded organiser demo per tournament.
 * Reset deletes only rows listed in auction_demo_owned_records for the loaded session.
 */
export const auctionDemoSessionsTable = pgTable(
  "auction_demo_sessions",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    organizerId: integer("organizer_id").notNull(),
    status: text("status").notNull().default("loaded"),
    settingsBefore: jsonb("settings_before").$type<Record<string, unknown>>().notNull(),
    settingsApplied: jsonb("settings_applied").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    resetBy: text("reset_by"),
  },
  (t) => [
    uniqueIndex("ux_auction_demo_sessions_one_loaded")
      .on(t.tournamentId)
      .where(sql`status = 'loaded'`),
    index("ix_auction_demo_sessions_tournament").on(t.tournamentId),
  ],
);

/** Explicit ownership marker. Reset never matches demo rows by name, logo URL, or team order. */
export const auctionDemoOwnedRecordsTable = pgTable(
  "auction_demo_owned_records",
  {
    id: serial("id").primaryKey(),
    demoSessionId: text("demo_session_id")
      .notNull()
      .references(() => auctionDemoSessionsTable.id, { onDelete: "cascade" }),
    tournamentId: integer("tournament_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    mediaUrl: text("media_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_auction_demo_owned").on(t.demoSessionId, t.entityType, t.entityId),
    index("ix_auction_demo_owned_session").on(t.demoSessionId),
    index("ix_auction_demo_owned_tournament").on(t.tournamentId),
  ],
);

export type AuctionDemoSession = typeof auctionDemoSessionsTable.$inferSelect;
export type AuctionDemoOwnedRecord = typeof auctionDemoOwnedRecordsTable.$inferSelect;
