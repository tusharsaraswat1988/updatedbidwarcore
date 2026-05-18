import { pgTable, text, serial, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Master list of sports supported by BidWar.
 * Replaces hardcoded sport enums throughout the codebase.
 */
export const sportsTable = pgTable(
  "sports",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ix_sports_slug").on(t.slug)],
);

/**
 * Player roles per sport (e.g. Batsman, Bowler for Cricket).
 */
export const sportRolesTable = pgTable(
  "sport_roles",
  {
    id: serial("id").primaryKey(),
    sportId: integer("sport_id").notNull(),
    roleName: text("role_name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("ix_sport_roles_sport_id").on(t.sportId)],
);

/**
 * Specification groups per role (e.g. "Batting Hand" for Batsman).
 * Up to 3 per role, all optional.
 */
export const roleSpecGroupsTable = pgTable(
  "role_spec_groups",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id").notNull(),
    groupName: text("group_name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    optional: boolean("optional").notNull().default(true),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("ix_role_spec_groups_role_id").on(t.roleId)],
);

/**
 * Options within a specification group (e.g. "Right Hand", "Left Hand").
 */
export const roleSpecOptionsTable = pgTable(
  "role_spec_options",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull(),
    optionName: text("option_name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("ix_role_spec_options_group_id").on(t.groupId)],
);

export const insertSportSchema = createInsertSchema(sportsTable).omit({ id: true, createdAt: true });
export const insertSportRoleSchema = createInsertSchema(sportRolesTable).omit({ id: true });
export const insertRoleSpecGroupSchema = createInsertSchema(roleSpecGroupsTable).omit({ id: true });
export const insertRoleSpecOptionSchema = createInsertSchema(roleSpecOptionsTable).omit({ id: true });

export type Sport = typeof sportsTable.$inferSelect;
export type SportRole = typeof sportRolesTable.$inferSelect;
export type RoleSpecGroup = typeof roleSpecGroupsTable.$inferSelect;
export type RoleSpecOption = typeof roleSpecOptionsTable.$inferSelect;
export type InsertSport = z.infer<typeof insertSportSchema>;
export type InsertSportRole = z.infer<typeof insertSportRoleSchema>;
