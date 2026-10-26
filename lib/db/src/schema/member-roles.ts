import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { tournamentsTable } from "./tournaments";
import { teamsTable } from "./teams";
import { scoringMatchesTable } from "./scoring_matches";

/**
 * Extensible Member capabilities and roles.
 * Supports Global, Tournament-scoped, Team-scoped, and Match-scoped roles.
 *
 * Examples:
 * - organizer (global or tournament-scoped)
 * - player (tournament-scoped)
 * - scorer (global or tournament-scoped)
 * - umpire, referee, match_official (tournament or match-scoped)
 * - team_owner, coach, mentor, team_manager (team-scoped)
 * - fan, live_streamer, associate, official
 */
export const memberRolesTable = pgTable(
  "member_roles",
  {
    id: serial("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    /** Role badge: organizer | player | scorer | umpire | referee | match_official | team_owner | coach | mentor | team_manager | fan | live_streamer | associate | official */
    role: text("role").notNull(),
    /** Role assignment scope: global | tournament | team | match */
    scope: text("scope").notNull().default("global"),
    /** Optional scope context references */
    tournamentId: integer("tournament_id").references(() => tournamentsTable.id, {
      onDelete: "cascade",
    }),
    teamId: integer("team_id").references(() => teamsTable.id, {
      onDelete: "cascade",
    }),
    matchId: integer("match_id").references(() => scoringMatchesTable.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_member_roles_member_id").on(t.memberId),
    index("ix_member_roles_role").on(t.role),
    index("ix_member_roles_scope").on(t.scope),
    index("ix_member_roles_tournament_id").on(t.tournamentId),
    index("ix_member_roles_team_id").on(t.teamId),
    index("ix_member_roles_match_id").on(t.matchId),
  ],
);

export const insertMemberRoleSchema = createInsertSchema(memberRolesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectMemberRoleSchema = createSelectSchema(memberRolesTable);

export type MemberRole = typeof memberRolesTable.$inferSelect;
export type InsertMemberRole = z.infer<typeof insertMemberRoleSchema>;
