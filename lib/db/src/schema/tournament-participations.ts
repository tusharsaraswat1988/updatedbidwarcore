import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { tournamentsTable } from "./tournaments";
import { teamsTable } from "./teams";

/**
 * Generic Tournament Participation relationship.
 * Maps Member ↔ Tournament ↔ Role.
 *
 * Supports multi-role participation (e.g. Player + Team Owner in the same tournament).
 * Domain specifics (Auction economics, Scoring stats) remain in their respective domains.
 */
export const tournamentParticipationsTable = pgTable(
  "tournament_participations",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    /** Participation role: player | scorer | team_owner | coach | match_official | organizer */
    role: text("role").notNull().default("player"),
    /** Participation status: active | withdrawn | disqualified | completed */
    status: text("status").notNull().default("active"),
    /** Optional assigned team */
    teamId: integer("team_id").references(() => teamsTable.id, {
      onDelete: "set null",
    }),
    /** Tournament event category id (e.g. Men's Singles, Under-19) */
    categoryId: integer("category_id"),
    /** Tournament-specific display name override */
    displayNameOverride: text("display_name_override"),
    /** Tournament-specific scoreboard initials (e.g. "TS2") */
    initials: text("initials"),
    jerseyNumber: text("jersey_number"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_tp_tournament_member_role").on(
      t.tournamentId,
      t.memberId,
      t.role,
    ),
    index("ix_tp_tournament_id").on(t.tournamentId),
    index("ix_tp_member_id").on(t.memberId),
    index("ix_tp_team_id").on(t.teamId),
    index("ix_tp_role").on(t.role),
    index("ix_tp_status").on(t.status),
  ],
);

export const insertTournamentParticipationSchema = createInsertSchema(
  tournamentParticipationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectTournamentParticipationSchema = createSelectSchema(
  tournamentParticipationsTable,
);

export type TournamentParticipation =
  typeof tournamentParticipationsTable.$inferSelect;
export type InsertTournamentParticipation = z.infer<
  typeof insertTournamentParticipationSchema
>;
