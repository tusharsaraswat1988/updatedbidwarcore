import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

/** Workbook version history — snapshot after each successful TMW import */
export const workbookVersionsTable = pgTable(
  "workbook_versions",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    jobId: integer("job_id"),
    versionLabel: text("version_label").notNull(),
    versionNotes: text("version_notes"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    snapshotMeta: jsonb("snapshot_meta"),
    manifestSnapshot: jsonb("manifest_snapshot"),
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
    rolledBackBy: text("rolled_back_by"),
  },
  (t) => [
    index("ix_workbook_versions_tournament").on(t.tournamentId, t.createdAt),
  ],
);

export type WorkbookVersion = typeof workbookVersionsTable.$inferSelect;
