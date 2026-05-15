import { pgTable, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Audit log for every player import operation.
 * Tracks who imported players from which tournament to which tournament.
 */
export const playerImportLogsTable = pgTable(
  "player_import_logs",
  {
    id: serial("id").primaryKey(),
    organizerAccountId: integer("organizer_account_id"), // nullable — null if imported by admin/operator without account
    sourceTournamentId: integer("source_tournament_id").notNull(),
    targetTournamentId: integer("target_tournament_id").notNull(),
    playerCount: integer("player_count").notNull().default(0),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_pil_target_tournament").on(t.targetTournamentId),
    index("ix_pil_source_tournament").on(t.sourceTournamentId),
    index("ix_pil_organizer").on(t.organizerAccountId),
  ],
);

export const insertPlayerImportLogSchema = createInsertSchema(playerImportLogsTable).omit({
  id: true,
  importedAt: true,
});
export type InsertPlayerImportLog = z.infer<typeof insertPlayerImportLogSchema>;
export type PlayerImportLog = typeof playerImportLogsTable.$inferSelect;
