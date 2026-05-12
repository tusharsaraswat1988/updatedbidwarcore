import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const syncQueueTable = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operation: text("operation").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  syncedAt: text("synced_at"),
  failed: integer("failed", { mode: "boolean" }).notNull().default(false),
  error: text("error"),
});

export type SyncQueueEntry = typeof syncQueueTable.$inferSelect;
