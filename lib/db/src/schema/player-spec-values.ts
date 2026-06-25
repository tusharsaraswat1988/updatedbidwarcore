import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Normalized per-player sport specification values.
 * One row per (tournament player, role spec group).
 */
export const playerSpecValuesTable = pgTable(
  "player_spec_values",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id").notNull(),
    specGroupId: integer("spec_group_id").notNull(),
    valueText: text("value_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_psv_player_spec_group").on(t.playerId, t.specGroupId),
    index("ix_psv_player_id").on(t.playerId),
    index("ix_psv_spec_group_id").on(t.specGroupId),
  ],
);

export const insertPlayerSpecValueSchema = createInsertSchema(playerSpecValuesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlayerSpecValue = typeof playerSpecValuesTable.$inferSelect;
export type InsertPlayerSpecValue = z.infer<typeof insertPlayerSpecValueSchema>;
