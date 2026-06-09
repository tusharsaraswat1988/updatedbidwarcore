/**
 * Tournament-scoped player identity — separate from master player and auction franchise.
 *
 * Initials, display name overrides, and tournament metadata live here.
 * Master player (global_players) holds cross-tournament identity only.
 */

import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentPlayerProfilesTable = pgTable(
  "tournament_player_profiles",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    masterPlayerId: text("master_player_id").notNull(),
    displayName: text("display_name").notNull(),
    /** Tournament-unique initials (AK, AK2, …) — never stored on master player. */
    initials: text("initials").notNull(),
    photoOverrideUrl: text("photo_override_url"),
    category: text("category"),
    seedRank: integer("seed_rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_tpp_tournament_master_player").on(t.tournamentId, t.masterPlayerId),
    index("ix_tpp_tournament_id").on(t.tournamentId),
    index("ix_tpp_master_player_id").on(t.masterPlayerId),
    uniqueIndex("uq_tpp_tournament_initials")
      .on(t.tournamentId, t.initials),
  ],
);

export const insertTournamentPlayerProfileSchema = createInsertSchema(
  tournamentPlayerProfilesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TournamentPlayerProfile = typeof tournamentPlayerProfilesTable.$inferSelect;
export type InsertTournamentPlayerProfile = z.infer<typeof insertTournamentPlayerProfileSchema>;
