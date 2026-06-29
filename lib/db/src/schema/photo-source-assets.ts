import {
  pgTable,
  text,
  integer,
  bigserial,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Cross-tournament cache for imported photo sources (Drive file ID / checksum dedup). */
export const photoSourceAssetsTable = pgTable(
  "photo_source_assets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceKey: text("source_key").notNull(),
    sourceType: text("source_type").notNull(),
    driveFileId: text("drive_file_id"),
    checksum: text("checksum").notNull(),
    originalSourceUrl: text("original_source_url").notNull(),
    originalFileName: text("original_file_name"),
    originalUrl: text("original_url").notNull(),
    originalPublicId: text("original_public_id").notNull(),
    originalWidth: integer("original_width"),
    originalHeight: integer("original_height"),
    originalBytes: integer("original_bytes"),
    originalFormat: text("original_format"),
    standardUrl: text("standard_url").notNull(),
    standardPublicId: text("standard_public_id").notNull(),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull(),
    processingVersion: text("processing_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_photo_source_assets_source_key").on(t.sourceKey),
    index("ix_photo_source_assets_checksum").on(t.checksum),
    index("ix_photo_source_assets_drive_file_id").on(t.driveFileId),
  ],
);

export type PhotoSourceAsset = typeof photoSourceAssetsTable.$inferSelect;
