import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tournamentsTable } from "./tournaments";

/**
 * Cricket sponsor / promo media slots.
 * One tournament holds up to four slots. The original upload and the
 * broadcast-ready asset are stored separately. Scoring tables are not involved.
 */
export const cricketSponsorMediaSlotsTable = pgTable(
  "cricket_sponsor_media_slots",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(),
    title: text("title").notNull().default(""),
    assetType: text("asset_type"),
    originalUrl: text("original_url"),
    originalPublicId: text("original_public_id"),
    broadcastUrl: text("broadcast_url"),
    broadcastPublicId: text("broadcast_public_id"),
    posterUrl: text("poster_url"),
    durationMs: integer("duration_ms").notNull().default(10_000),
    fileSizeBytes: integer("file_size_bytes"),
    originalFileSizeBytes: integer("original_file_size_bytes"),
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    hasAudio: boolean("has_audio").notNull().default(false),
    processingStatus: text("processing_status").notNull().default("empty"),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(0),
    checksum: text("checksum"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("ux_cricket_sponsor_media_slots_tournament_slot").on(t.tournamentId, t.slotNumber),
    index("ix_cricket_sponsor_media_slots_tournament_id").on(t.tournamentId),
  ],
);

export type CricketSponsorMediaSlot = typeof cricketSponsorMediaSlotsTable.$inferSelect;
