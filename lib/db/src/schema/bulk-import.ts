import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Reusable bulk import job tracking — auction data, teams, sponsors, etc. */
export const bulkImportJobsTable = pgTable(
  "bulk_import_jobs",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    moduleType: text("module_type").notNull().default("bidwar_master_workbook"),
    importMode: text("import_mode"),
    sourceType: text("source_type").default("excel"),
    googleSheetUrl: text("google_sheet_url"),
    workbookVersionId: integer("workbook_version_id"),
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    fileName: text("file_name"),
    ipAddress: text("ip_address"),
    browser: text("browser"),
    processingTimeMs: integer("processing_time_ms"),
    status: text("status").notNull().default("pending"), // pending | validated | committed | failed | rolled_back
    totalRows: integer("total_rows").notNull().default(0),
    updatedRows: integer("updated_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    skippedRows: integer("skipped_rows").notNull().default(0),
    previewJson: jsonb("preview_json"),
    errorReportJson: jsonb("error_report_json"),
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
    rolledBackBy: text("rolled_back_by"),
  },
  (t) => [
    index("ix_bulk_import_jobs_tournament").on(t.tournamentId, t.uploadedAt),
    index("ix_bulk_import_jobs_module").on(t.moduleType, t.uploadedAt),
  ],
);

export const bulkImportJobItemsTable = pgTable(
  "bulk_import_job_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: integer("job_id").notNull(),
    playerId: integer("player_id"),
    fieldName: text("field_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    status: text("status").notNull().default("pending"), // pending | updated | skipped | error
    errorMessage: text("error_message"),
  },
  (t) => [
    index("ix_bulk_import_job_items_job").on(t.jobId),
    index("ix_bulk_import_job_items_player").on(t.playerId),
  ],
);

export const insertBulkImportJobSchema = createInsertSchema(bulkImportJobsTable).omit({
  id: true,
  uploadedAt: true,
});

export type BulkImportJob = typeof bulkImportJobsTable.$inferSelect;
export type InsertBulkImportJob = z.infer<typeof insertBulkImportJobSchema>;
export type BulkImportJobItem = typeof bulkImportJobItemsTable.$inferSelect;
