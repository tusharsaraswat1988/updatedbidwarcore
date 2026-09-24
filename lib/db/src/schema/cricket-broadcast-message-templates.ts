import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";

/**
 * Cricket Broadcast Message Templates.
 * Tournament-scoped reusable templates for broadcast chyron cards (guests, sponsors, officials, etc.).
 */
export const cricketBroadcastMessageTemplatesTable = pgTable(
  "cricket_broadcast_message_templates",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_cricket_broadcast_message_templates_tournament_id").on(t.tournamentId),
  ],
);

export const insertCricketBroadcastMessageTemplateSchema = createInsertSchema(
  cricketBroadcastMessageTemplatesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CricketBroadcastMessageTemplate = typeof cricketBroadcastMessageTemplatesTable.$inferSelect;
export type InsertCricketBroadcastMessageTemplate = z.infer<typeof insertCricketBroadcastMessageTemplateSchema>;
