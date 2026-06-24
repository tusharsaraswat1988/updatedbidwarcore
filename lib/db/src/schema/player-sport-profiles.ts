import {
  pgTable,
  text,
  serial,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-sport profile for a global player identity.
 * One row per (global_player_id, sport_slug).
 */
export const playerSportProfilesTable = pgTable(
  "player_sport_profiles",
  {
    id: serial("id").primaryKey(),
    globalPlayerId: text("global_player_id").notNull(),
    sportSlug: text("sport_slug").notNull(),
    defaultRole: text("default_role"),
    profileJson: jsonb("profile_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_psp_global_player_sport").on(t.globalPlayerId, t.sportSlug),
    index("ix_psp_global_player_id").on(t.globalPlayerId),
    index("ix_psp_sport_slug").on(t.sportSlug),
  ],
);

export const insertPlayerSportProfileSchema = createInsertSchema(playerSportProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlayerSportProfile = typeof playerSportProfilesTable.$inferSelect;
export type InsertPlayerSportProfile = z.infer<typeof insertPlayerSportProfileSchema>;
