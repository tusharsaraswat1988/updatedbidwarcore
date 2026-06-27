import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const GOOGLE_SHEET_SYNC_STATUSES = ["CONNECTED", "SYNCING", "ERROR", "DISCONNECTED"] as const;
export type GoogleSheetSyncStatus = (typeof GOOGLE_SHEET_SYNC_STATUSES)[number];

/** One persistent Google Sheet per tournament for live player roster sync. */
export const googleSheetSyncsTable = pgTable(
  "google_sheet_syncs",
  {
    id: serial("id").primaryKey(),
    organizerId: integer("organizer_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    spreadsheetId: text("spreadsheet_id").notNull(),
    spreadsheetUrl: text("spreadsheet_url").notNull(),
    syncStatus: text("sync_status").notNull().default("CONNECTED"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("google_sheet_syncs_tournament_id_idx").on(table.tournamentId)],
);

export type GoogleSheetSync = typeof googleSheetSyncsTable.$inferSelect;
