import {
  pgTable,
  text,
  integer,
  bigserial,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

/** Per-photo tracking for BMW Google Drive photo import pipeline. */
export const bulkImportPhotoItemsTable = pgTable(
  "bulk_import_photo_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: integer("job_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    playerId: integer("player_id"),
    playerName: text("player_name"),
    sheetRow: integer("sheet_row"),
    sourceUrl: text("source_url").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceType: text("source_type"),
    driveFileId: text("drive_file_id"),
    originalFileName: text("original_file_name"),
    /** pending | processing | uploaded | failed | skipped */
    status: text("status").notNull().default("pending"),
    /** accessible | private | broken | not_image | unsupported | skipped_cloudinary | skipped_mode */
    validationStatus: text("validation_status"),
    /** Optimized standard player card image */
    storedUrl: text("stored_url"),
    publicId: text("public_id"),
    /** Full-resolution original preserved in Cloudinary */
    originalStoredUrl: text("original_stored_url"),
    originalPublicId: text("original_public_id"),
    originalWidth: integer("original_width"),
    originalHeight: integer("original_height"),
    originalBytes: integer("original_bytes"),
    originalFormat: text("original_format"),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
    qualityWarnings: jsonb("quality_warnings").$type<string[]>(),
    failureReason: text("failure_reason"),
    skipReason: text("skip_reason"),
    reusedFromItemId: integer("reused_from_item_id"),
    reusedFromCacheId: integer("reused_from_cache_id"),
    retryCount: integer("retry_count").notNull().default(0),
    hadExistingPhoto: integer("had_existing_photo").notNull().default(0),
    photoImportMode: text("photo_import_mode"),
    processingVersion: text("processing_version"),
    uploadedBy: text("uploaded_by").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_bulk_import_photo_items_job").on(t.jobId),
    index("ix_bulk_import_photo_items_tournament").on(t.tournamentId),
    index("ix_bulk_import_photo_items_source_key").on(t.tournamentId, t.sourceKey),
    index("ix_bulk_import_photo_items_status").on(t.jobId, t.status),
  ],
);

export type BulkImportPhotoItem = typeof bulkImportPhotoItemsTable.$inferSelect;
