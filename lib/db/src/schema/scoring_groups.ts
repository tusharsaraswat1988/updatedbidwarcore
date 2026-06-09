import {
  pgTable,
  serial,
  text,
  integer,
  smallint,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoringGroupsTable = pgTable(
  "scoring_groups",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    drawId: integer("draw_id").notNull(),
    name: text("name").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_scoring_groups_tournament_id").on(t.tournamentId),
    index("ix_scoring_groups_draw_id").on(t.drawId),
  ],
);

export const scoringGroupMembersTable = pgTable(
  "scoring_group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull(),
    teamId: integer("team_id").notNull(),
    seed: smallint("seed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_scoring_group_members_group_team").on(t.groupId, t.teamId),
    index("ix_scoring_group_members_group_id").on(t.groupId),
  ],
);

export const insertScoringGroupSchema = createInsertSchema(scoringGroupsTable).omit({
  id: true,
  createdAt: true,
});

export const insertScoringGroupMemberSchema = createInsertSchema(scoringGroupMembersTable).omit({
  id: true,
  createdAt: true,
});

export type ScoringGroup = typeof scoringGroupsTable.$inferSelect;
export type ScoringGroupMember = typeof scoringGroupMembersTable.$inferSelect;
