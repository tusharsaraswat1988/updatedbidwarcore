import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Key-value JSON blobs for venue-only data (branding, media manifest, etc.). */
export const venueSnapshotsTable = sqliteTable("venue_snapshots", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});
